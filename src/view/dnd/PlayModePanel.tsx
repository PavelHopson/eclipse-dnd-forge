import { Button, Textarea, Tooltip } from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { GiCrown, GiMeeple, GiScrollQuill } from "react-icons/gi";
import { IoClose, IoSend } from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import { runGameTurn } from "../../model/agents/DmOrchestrator";
import { insertNpcQuoteAtCursor, insertTextAtCursor } from "../../model/agents/sessionInjector";
import { GameLoopEntry, GameLoopPhase, useGameLoopStore } from "../../store/useGameLoopStore";

interface PlayModePanelProps {
    onClose: () => void;
}

const PHASE_LABEL: Record<GameLoopPhase, string> = {
    "idle": "",
    "awaiting-player": "Ваш ход",
    "dm-narrating": "🎲 Мастер ведёт сцену…",
    "npc-reacting": "💬 Персонажи отвечают…",
};

/** Insert a transcript beat into the canonical Slate session text. */
function insertEntry(entry: GameLoopEntry) {
    if (entry.kind === "npc" && entry.speaker) {
        insertNpcQuoteAtCursor(entry.speaker, entry.content);
    } else {
        insertTextAtCursor(entry.content);
    }
}

export default function PlayModePanel({ onClose }: PlayModePanelProps) {
    const phase = useGameLoopStore((s) => s.phase);
    const turnLog = useGameLoopStore((s) => s.turnLog);
    const turn = useGameLoopStore((s) => s.turn);
    const activeStreamId = useGameLoopStore((s) => s.activeStreamId);

    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const latestTurnContent = turnLog[turnLog.length - 1]?.content;

    const isBusy = phase === "dm-narrating" || phase === "npc-reacting";
    const canSend = phase === "awaiting-player";

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [turnLog.length, activeStreamId, latestTurnContent]);

    const send = async () => {
        const trimmed = input.trim();
        if (!trimmed || !canSend) return;
        setInput("");
        await runGameTurn(trimmed);
    };

    return (
        <div
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 480,
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
                    <GiMeeple style={{ fontSize: 28, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>Режим игры</span>
                        <span style={{ fontSize: 10, color: "#6b5c4c", lineHeight: 1.1 }}>
                            Автономный стол — Мастер и персонажи ведут ход за вас
                        </span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Закрыть режим игры">
                    <IoClose />
                </Button>
            </div>

            {phase === "idle" ? (
                /* Start screen */
                <div
                    style={{
                        background: "#fffefb",
                        border: "1px solid #e8dcc0",
                        borderRadius: 6,
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        alignItems: "center",
                        textAlign: "center",
                    }}
                >
                    <GiMeeple style={{ fontSize: 40, color: "#7a1f1f", opacity: 0.5 }} />
                    <div style={{ fontSize: 12.5, color: "#3a2a2a", lineHeight: 1.5 }}>
                        Опишите действие партии — Мастер опишет последствия, а названные по имени
                        NPC и монстры ответят своими голосами. Каждый ход возвращается к вам.
                    </div>
                    {turnLog.length > 0 && (
                        <div style={{ fontSize: 11, color: "#6b5c4c" }}>
                            В журнале {turnLog.length} реплик за {turn} ходов — игра продолжится с того же места.
                        </div>
                    )}
                    <Button
                        size="sm"
                        onClick={() => useGameLoopStore.getState().start()}
                        style={{ background: "#7a1f1f", color: "white" }}
                    >
                        {turnLog.length > 0 ? "Продолжить игру" : "Начать игру"}
                    </Button>
                </div>
            ) : (
                <>
                    {/* Transcript */}
                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            background: "#fffefb",
                            border: "1px solid #e8dcc0",
                            borderRadius: 6,
                            padding: 8,
                            minHeight: 260,
                            maxHeight: 440,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                        }}
                    >
                        {turnLog.length === 0 && (
                            <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 24, fontSize: 12 }}>
                                <div>Игра началась. Опишите, что делает партия.</div>
                                <div style={{ marginTop: 4, opacity: 0.7 }}>
                                    <em>«Мы входим в таверну и осматриваемся.»</em> ·{" "}
                                    <em>«Я спрашиваю Тоблена про обвал на руднике.»</em>
                                </div>
                            </div>
                        )}
                        {turnLog.map((entry) => {
                            const isStreaming = entry.id === activeStreamId;
                            if (entry.kind === "player") {
                                return (
                                    <div
                                        key={entry.id}
                                        style={{
                                            alignSelf: "flex-end",
                                            maxWidth: "85%",
                                            padding: "8px 10px",
                                            borderRadius: 8,
                                            background: "#2f3e4e",
                                            color: "#f3efe6",
                                            fontSize: 12.5,
                                            lineHeight: 1.5,
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {entry.content}
                                    </div>
                                );
                            }
                            const isDm = entry.kind === "dm";
                            return (
                                <div
                                    key={entry.id}
                                    style={{
                                        alignSelf: "stretch",
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        background: isDm ? "#f0e4c8" : "#fffefb",
                                        borderLeft: isDm ? undefined : "3px solid #7a1f1f",
                                        border: isDm ? undefined : "1px solid #e8dcc0",
                                        color: "#2a1a1a",
                                        fontSize: 12.5,
                                        lineHeight: 1.5,
                                        wordBreak: "break-word",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                                        {isDm
                                            ? <GiCrown style={{ fontSize: 15, color: "#7a1f1f" }} />
                                            : <GiMeeple style={{ fontSize: 14, color: "#7a1f1f" }} />}
                                        <span style={{ fontWeight: 700, fontSize: 11, color: "#7a1f1f" }}>
                                            {entry.speaker}
                                        </span>
                                    </div>
                                    {entry.content
                                        ? (
                                            <div className="agent-md">
                                                <ReactMarkdown>{entry.content}</ReactMarkdown>
                                            </div>
                                        )
                                        : (isStreaming ? "…" : "")}
                                    {entry.content && !isStreaming && (
                                        <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                                            <Tooltip content="Вставить эту реплику в текст сессии" closeDelay={0}>
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    startContent={<GiScrollQuill />}
                                                    onClick={() => insertEntry(entry)}
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
                    </div>

                    {/* Phase / turn status */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 11,
                            color: "#3a2a2a",
                            background: isBusy ? "#fff1c8" : "#e6f0d2",
                            padding: "5px 8px",
                            borderRadius: 6,
                            border: "1px solid #d4c5a0",
                        }}
                    >
                        <span>{PHASE_LABEL[phase]}</span>
                        <span style={{ opacity: 0.7 }}>Ход {turn}</span>
                    </div>

                    {/* Input */}
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                        <Textarea
                            size="sm"
                            variant="faded"
                            placeholder="Что делает партия?"
                            value={input}
                            onValueChange={setInput}
                            minRows={1}
                            maxRows={4}
                            isDisabled={!canSend}
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
                            isLoading={isBusy}
                            onClick={send}
                            isDisabled={!canSend || input.trim().length === 0}
                            style={{ background: "#7a1f1f", color: "white", height: 36 }}
                            aria-label="Отправить ход"
                        >
                            <IoSend />
                        </Button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button
                            size="sm"
                            variant="light"
                            onClick={() => useGameLoopStore.getState().reset()}
                            isDisabled={isBusy}
                            style={{ height: 26, minHeight: 26, fontSize: 10, color: "#7a1f1f" }}
                        >
                            Завершить игру
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
