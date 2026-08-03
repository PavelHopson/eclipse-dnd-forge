import { Button, Textarea, Tooltip } from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { GiBroom, GiChatBubble, GiCrossedSwords, GiScrollQuill } from "react-icons/gi";
import { IoClose, IoSend } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import { Entity, EntityKind, useModelStore } from "../../model/Model";
import { suggestCombatTactic } from "../../model/agents/CombatAgent";
import { runNpcDialogue } from "../../model/agents/NpcAgent";
import { insertTextAtCursor, insertNpcQuoteAtCursor } from "../../model/agents/sessionInjector";
import { useAgentStore } from "../../store/useAgentStore";

interface NpcDialoguePanelProps {
    entityId: string;
    onClose: () => void;
}

const KIND_STYLE: Record<EntityKind, { label: string; bg: string; fg: string }> = {
    hero: { label: "Герой", bg: "#1e3a8a", fg: "#dbeafe" },
    npc: { label: "NPC", bg: "#854d0e", fg: "#fef3c7" },
    monster: { label: "Монстр", bg: "#7f1d1d", fg: "#fecaca" },
    faction: { label: "Фракция", bg: "#3f3f46", fg: "#e4e4e7" },
    unknown: { label: "—", bg: "#e5e7eb", fg: "#374151" },
};

export default function NpcDialoguePanel({ entityId, onClose }: NpcDialoguePanelProps) {
    const entityNode = useModelStore((s) => s.entityNodes.find((n) => n.id === entityId));
    const history = useAgentStore((s) => s.histories[entityId] ?? []);
    const streaming = useAgentStore((s) => !!s.streaming[entityId]);

    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [tactic, setTactic] = useState<string>("");
    const [tacticStreaming, setTacticStreaming] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const latestMessageContent = history[history.length - 1]?.content;

    // Auto-scroll the chat log to the bottom on new content.
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history.length, streaming, latestMessageContent]);

    if (!entityNode) {
        return null;
    }
    const entity = entityNode.data as Entity;

    const send = async () => {
        const trimmed = input.trim();
        if (!trimmed || streaming) return;

        setError(null);
        setInput("");

        const agent = useAgentStore.getState();
        // Snapshot the conversation BEFORE we add the new turn — that's what the
        // model needs as `priorHistory`. Otherwise we'd send the new user message twice.
        const priorHistory = agent.getHistory(entityId);

        agent.appendUserMessage(entityId, trimmed);
        agent.setStreaming(entityId, true);
        // Seed an empty assistant message so the UI shows the bubble immediately.
        agent.updateAssistantStream(entityId, "");

        try {
            await runNpcDialogue(entityId, priorHistory, trimmed, (partial) => {
                useAgentStore.getState().updateAssistantStream(entityId, partial);
            });
        } catch (e: any) {
            const message = typeof e?.message === "string"
                ? e.message
                : "Не удалось получить ответ. Проверьте API-ключ и попробуйте снова.";
            setError(message);
            // Replace the empty assistant bubble with an in-character apology so the log stays coherent.
            useAgentStore.getState().updateAssistantStream(entityId, `*замолкает, выглядит растерянно.* Я... потерял мысль на мгновение. (${message})`);
        } finally {
            useAgentStore.getState().setStreaming(entityId, false);
        }
    };

    const clear = () => {
        useAgentStore.getState().clearHistory(entityId);
        setError(null);
        setInput("");
        setTactic("");
    };

    const suggestTactic = async () => {
        if (tacticStreaming) return;
        setError(null);
        setTactic("");
        setTacticStreaming(true);
        try {
            await suggestCombatTactic(entityId, (partial) => setTactic(partial));
        } catch (e: any) {
            const message = typeof e?.message === "string" ? e.message : "Не удалось получить тактическое предложение.";
            setError(message);
        } finally {
            setTacticStreaming(false);
        }
    };

    const isMonster = entity.kind === "monster";
    const kindStyle = KIND_STYLE[entity.kind ?? "unknown"];

    return (
        <div
            className="dnd-overlay-panel"
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 380,
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 32 }}>{entity.emoji}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>{entity.name}</span>
                        {entity.role && (
                            <span style={{ fontSize: 11, color: "#6b5c4c", lineHeight: 1.1 }}>{entity.role}</span>
                        )}
                        {entity.kind && entity.kind !== "unknown" && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 999,
                                    background: kindStyle.bg,
                                    color: kindStyle.fg,
                                    letterSpacing: 0.3,
                                    textTransform: "uppercase",
                                    alignSelf: "flex-start",
                                    marginTop: 2,
                                }}
                            >
                                {kindStyle.label}
                            </span>
                        )}
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Закрыть диалог">
                    <IoClose />
                </Button>
            </div>

            {/* DM-only context hint — collapsed by default, expanded on demand */}
            {(entity.goal || entity.secret) && (
                <details style={{ fontSize: 11, color: "#5a4a3a", background: "#f0e4c8", padding: "6px 8px", borderRadius: 6 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700 }}>Контекст (видит только мастер)</summary>
                    {entity.goal && (
                        <div style={{ marginTop: 4 }}>
                            <span style={{ fontWeight: 700 }}>Цель:</span> {entity.goal}
                        </div>
                    )}
                    {entity.secret && (
                        <div style={{ marginTop: 4 }}>
                            <span style={{ fontWeight: 700 }}>Секрет:</span> {entity.secret}
                        </div>
                    )}
                </details>
            )}

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
                    minHeight: 200,
                    maxHeight: 340,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}
            >
                {history.length === 0 && !streaming && (
                    <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 16, fontSize: 12 }}>
                        <GiChatBubble style={{ fontSize: 24, opacity: 0.5 }} />
                        <div style={{ marginTop: 6 }}>Скажите что-нибудь {entity.name}.</div>
                    </div>
                )}
                {history.map((m, idx) => {
                    const isAssistant = m.role === "assistant";
                    return (
                        <div
                            key={idx}
                            style={{
                                alignSelf: isAssistant ? "flex-start" : "flex-end",
                                maxWidth: "85%",
                                padding: "6px 10px",
                                borderRadius: 8,
                                background: isAssistant ? "#f0e4c8" : "#7a1f1f",
                                color: isAssistant ? "#2a1a1a" : "#fdf6e3",
                                fontSize: 12,
                                lineHeight: 1.45,
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
                                <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end" }}>
                                    <Tooltip content={`Вставить реплику ${entity.name} в позицию курсора (или в конец, если курсора нет)`} closeDelay={0}>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            startContent={<GiScrollQuill />}
                                            onClick={() => insertNpcQuoteAtCursor(entity.name, m.content)}
                                            style={{
                                                height: 22,
                                                minHeight: 22,
                                                fontSize: 10,
                                                background: "#fffbf0",
                                                border: "1px solid #d4c5a0",
                                            }}
                                        >
                                            Вставить как реплику
                                        </Button>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {isMonster && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6, border: "1px dashed #b09060", borderRadius: 6, background: "#fff5e0" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#7a1f1f", display: "flex", alignItems: "center", gap: 4 }}>
                            <GiCrossedSwords /> Боевой AI
                        </span>
                        <Button
                            size="sm"
                            variant="flat"
                            isLoading={tacticStreaming}
                            isDisabled={tacticStreaming}
                            onClick={suggestTactic}
                            style={{ height: 22, minHeight: 22, fontSize: 10, background: "#7a1f1f", color: "white" }}
                        >
                            {tacticStreaming ? "Думаю…" : "Предложить тактику"}
                        </Button>
                    </div>
                    {tactic && (
                        <>
                            <div style={{ fontSize: 12, color: "#3a2a2a", lineHeight: 1.4, fontStyle: "italic" }}>
                                {tactic}
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <Tooltip content="Вставить предложенное действие в текст сессии в позицию курсора" closeDelay={0}>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        startContent={<GiScrollQuill />}
                                        onClick={() => insertTextAtCursor(tactic)}
                                        style={{ height: 22, minHeight: 22, fontSize: 10, background: "#fffbf0", border: "1px solid #d4c5a0" }}
                                    >
                                        Вставить тактику
                                    </Button>
                                </Tooltip>
                            </div>
                        </>
                    )}
                </div>
            )}

            {error && (
                <div style={{ fontSize: 11, color: "#7a1f1f", background: "#fde2e2", padding: 6, borderRadius: 6 }}>
                    {error}
                </div>
            )}

            {/* Input */}
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <Textarea
                    size="sm"
                    variant="faded"
                    placeholder={`Поговорите с ${entity.name}…`}
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
                    onClick={send}
                    isDisabled={streaming || input.trim().length === 0}
                    style={{ background: "#7a1f1f", color: "white", height: 36 }}
                    aria-label="Отправить"
                >
                    <IoSend />
                </Button>
                <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    onClick={clear}
                    isDisabled={streaming || history.length === 0}
                    style={{ height: 36 }}
                    aria-label="Очистить диалог"
                    title="Очистить диалог"
                >
                    <GiBroom />
                </Button>
            </div>
        </div>
    );
}
