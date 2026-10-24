import { Button, Textarea, Tooltip } from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { GiBroom, GiCrown, GiScrollQuill } from "react-icons/gi";
import { IoClose, IoSend } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import { useModelStore } from "../../model/Model";
import { DM_AGENT_ID, runDmTurn } from "../../model/agents/DmAgent";
import { extractNpcQuotes, mirrorDmQuotesToNpcHistories } from "../../model/agents/dmCrossReference";
import { insertTextAtCursor } from "../../model/agents/sessionInjector";
import { useAgentStore } from "../../store/useAgentStore";
import { useWorldEventStore } from "../../store/useWorldEventStore";
import { aiRecoveryMessage } from "../../model/ai/requestRecovery";
import { clearDmRecovery, readDmRecovery, saveDmRecovery } from "../../model/agents/dmRecoverySnapshot";
import { campaignRepository } from "../../model/dnd/campaignStorage";
import { flushCampaign } from "../../model/dnd/campaignPersistence";

interface DmAgentPanelProps {
    onClose: () => void;
}

export default function DmAgentPanel({ onClose }: DmAgentPanelProps) {
    const history = useAgentStore((s) => s.histories[DM_AGENT_ID] ?? []);
    const streaming = useAgentStore((s) => !!s.streaming[DM_AGENT_ID]);
    // Reactive subscribe so the "N events pending" chip updates live as ticks land.
    const pendingTickEvents = useWorldEventStore((s) =>
        s.events.filter((e) => !!e.action && e.createdAt > s.lastDmAcknowledgedAt),
    );

    const input = useAgentStore((s) => s.drafts[DM_AGENT_ID] ?? "");
    const setInput = (value: string) => useAgentStore.getState().setDraft(DM_AGENT_ID, value);
    const [error, setError] = useState<string | null>(null);
    const [moduleFailed, setModuleFailed] = useState(false);
    const [partial, setPartial] = useState("");
    const requestRef = useRef<AbortController | null>(null);
    const [lastMirrored, setLastMirrored] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const latestMessageContent = history[history.length - 1]?.content;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history.length, streaming, latestMessageContent, partial]);

    useEffect(() => {
        try {
            const id = campaignRepository().getActive()?.id;
            if (id) {
                const saved = readDmRecovery(sessionStorage, id);
                if (saved && useAgentStore.getState().getHistory(DM_AGENT_ID).length === 0) {
                    useAgentStore.setState((state) => ({
                        histories: { ...state.histories, [DM_AGENT_ID]: saved.history },
                        drafts: { ...state.drafts, [DM_AGENT_ID]: saved.draft },
                    }));
                }
                if (saved) clearDmRecovery(sessionStorage, id);
            }
        } catch { setError("Не удалось прочитать сохранённый запрос DM. Данные восстановления не перезаписаны."); }
        return () => {
            requestRef.current?.abort();
            requestRef.current = null;
            useAgentStore.getState().setStreaming(DM_AGENT_ID, false);
        };
    }, []);

    const send = async () => {
        const trimmed = input.trim();
        if (!trimmed || requestRef.current || streaming) return;

        setError(null);
        setModuleFailed(false);
        setLastMirrored([]);
        setPartial("");
        const controller = new AbortController();
        requestRef.current = controller;

        const agent = useAgentStore.getState();
        const priorHistory = agent.getHistory(DM_AGENT_ID);

        agent.setStreaming(DM_AGENT_ID, true);

        try {
            const finalText = await runDmTurn(priorHistory, trimmed, (partial) => {
                if (requestRef.current === controller) setPartial(partial);
            }, controller.signal);
            if (requestRef.current !== controller || controller.signal.aborted) return;
            // Only a complete successful turn becomes history. Failed partials are not canon.
            agent.appendUserMessage(DM_AGENT_ID, trimmed);
            agent.appendAssistantMessage(DM_AGENT_ID, finalText);
            setInput("");

            // Mirror any **Name:** "..." quotes the DM voiced into the
            // matching NPC chat histories so future per-NPC conversations
            // pick up the context.
            const entityNodes = useModelStore.getState().entityNodes;
            const quotes = extractNpcQuotes(finalText, entityNodes);
            if (quotes.length > 0) {
                mirrorDmQuotesToNpcHistories(quotes);
                setLastMirrored(Array.from(new Set(quotes.map((q) => q.entityName))));
            } else {
                setLastMirrored([]);
            }
        } catch (e) {
            if (requestRef.current !== controller) return;
            setError(aiRecoveryMessage(e));
            setModuleFailed(e instanceof Error && e.name === "AiModuleLoadError");
        } finally {
            if (requestRef.current === controller) {
                requestRef.current = null;
                setPartial("");
                useAgentStore.getState().setStreaming(DM_AGENT_ID, false);
            }
        }
    };

    const reloadModule = () => {
        try {
            if (!flushCampaign(true)) throw new Error("World not saved");
            const id = campaignRepository().getActive()?.id;
            if (!id) throw new Error("No campaign");
            saveDmRecovery(sessionStorage, id, { draft: input, history: useAgentStore.getState().getHistory(DM_AGENT_ID) });
            window.location.reload();
        } catch { setError("Перезагрузка отменена: не удалось сохранить данные. Скопируйте запрос и историю DM перед ручной перезагрузкой."); }
    };

    const clear = () => {
        useAgentStore.getState().clearHistory(DM_AGENT_ID);
        setError(null);
        setInput("");
    };

    return (
        <div
            className="dnd-overlay-panel"
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: "min(440px, calc(100% - 32px))",
                maxHeight: "calc(100% - 80px)",
                background: "#fffbf0",
                border: "1px solid #d4c5a0",
                borderRadius: 10,
                boxShadow: "rgba(0, 0, 0, 0.18) 0px 8px 24px",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 13,
            }}
        >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <GiCrown style={{ fontSize: 28, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>Мастер Подземелий</span>
                        <span style={{ fontSize: 10, color: "#6b5c4c", lineHeight: 1.1 }}>AI-рассказчик / арбитр текущей кампании</span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onPress={onClose} aria-label="Закрыть панель DM">
                    <IoClose />
                </Button>
            </div>

            {/* Conversation log */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: "auto",
                    background: "#fffefb",
                    border: "1px solid #e8dcc0",
                    borderRadius: 6,
                    padding: 8,
                    minHeight: 0,
                    maxHeight: 420,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                {history.length === 0 && !streaming && (
                    <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 24, fontSize: 12 }}>
                        <GiCrown style={{ fontSize: 32, opacity: 0.4 }} />
                        <div style={{ marginTop: 6 }}>Расскажите DM что делает ваш персонаж — или попросите задать сцену.</div>
                        <div style={{ marginTop: 4, opacity: 0.7 }}>
                            <em>«Опиши открывающую сцену.»</em> · <em>«Я осматриваю общий зал таверны.»</em> · <em>«Что мы видим, въезжая в Фандалин?»</em>
                        </div>
                    </div>
                )}
                {history.map((m, idx) => {
                    const isAssistant = m.role === "assistant";
                    return (
                        <div
                            key={idx}
                            style={{
                                alignSelf: isAssistant ? "stretch" : "flex-end",
                                maxWidth: isAssistant ? "100%" : "85%",
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: isAssistant ? "#f0e4c8" : "#7a1f1f",
                                color: isAssistant ? "#2a1a1a" : "#fdf6e3",
                                fontSize: 12.5,
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                            }}
                        >
                            {m.content
                                ? (
                                    <div className="agent-md">
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                )
                                : (isAssistant && streaming ? "…" : "")}
                            {isAssistant && m.content && (
                                <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                                    <Tooltip content="Вставить нарратив в позицию курсора (или в конец, если курсора нет)" closeDelay={0}>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            startContent={<GiScrollQuill />}
                                            onPress={() => insertTextAtCursor(m.content)}
                                            style={{
                                                height: 24,
                                                minHeight: 24,
                                                fontSize: 10,
                                                background: "#fffbf0",
                                                border: "1px solid #d4c5a0",
                                            }}
                                        >
                                            Вставить в сессию
                                        </Button>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    );
                })}
                {streaming && <div role="status" style={{ whiteSpace: "pre-wrap" }}>{partial || "AI готовит ответ…"}<div>Незавершённый ответ — ещё не добавлен в историю.</div></div>}
            </div>

            {pendingTickEvents.length > 0 && !streaming && (
                <div style={{ fontSize: 11, color: "#3a2a2a", background: "#fff1c8", padding: 6, borderRadius: 6, lineHeight: 1.35, border: "1px solid #d4c5a0" }}>
                    🌍 <strong>{pendingTickEvents.length}</strong> событий за кулисами ждёт — DM вплетёт их в следующий нарратив.
                </div>
            )}

            {lastMirrored.length > 0 && !streaming && (
                <div style={{ fontSize: 11, color: "#3a2a2a", background: "#e6f0d2", padding: 6, borderRadius: 6, lineHeight: 1.35 }}>
                    🪶 Реплики DM зеркалятся в чат-историю:{" "}
                    <strong>{lastMirrored.join(", ")}</strong>.{" "}
                    Кликните по этим нодам, чтобы продолжить разговор.
                </div>
            )}

            {error && (
                <div role="alert" style={{ flexShrink: 0, fontSize: 12, color: "#7a1f1f", background: "#fde2e2", padding: 6, borderRadius: 6 }}>
                    {error}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {moduleFailed
                            ? <Button size="sm" onPress={reloadModule}>Сохранить и перезагрузить</Button>
                            : <Button size="sm" onPress={() => void send()} isDisabled={streaming || !input.trim()}>Повторить запрос</Button>}
                        <Button size="sm" variant="light" onPress={() => setError(null)}>Закрыть ошибку</Button>
                    </div>
                </div>
            )}

            {/* Input */}
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                <Textarea
                    size="sm"
                    variant="faded"
                    placeholder="Опишите что делает партия — или попросите DM задать следующую сцену…"
                    aria-label="Запрос DM"
                    value={input}
                    onValueChange={setInput}
                    minRows={1}
                    maxRows={4}
                    isDisabled={streaming}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                        }
                    }}
                    classNames={{ inputWrapper: "!min-h-[36px]" }}
                />
                <Button
                    size="sm"
                    isIconOnly
                    isLoading={streaming}
                    onPress={() => void send()}
                    isDisabled={streaming || input.trim().length === 0}
                    style={{ background: "#7a1f1f", color: "white", height: 36 }}
                    aria-label="Отправить DM"
                >
                    <IoSend />
                </Button>
                {streaming && <Button size="sm" onPress={() => requestRef.current?.abort()}>Остановить</Button>}
                <Tooltip content="Очистить разговор с DM" closeDelay={0}>
                    <Button
                        size="sm"
                        isIconOnly
                        variant="light"
                        onPress={clear}
                        isDisabled={streaming || history.length === 0}
                        style={{ height: 36 }}
                        aria-label="Очистить разговор с DM"
                    >
                        <GiBroom />
                    </Button>
                </Tooltip>
            </div>
        </div>
    );
}
