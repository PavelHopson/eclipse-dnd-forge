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

    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [lastMirrored, setLastMirrored] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history.length, streaming, history[history.length - 1]?.content]);

    const send = async () => {
        const trimmed = input.trim();
        if (!trimmed || streaming) return;

        setError(null);
        setInput("");

        const agent = useAgentStore.getState();
        const priorHistory = agent.getHistory(DM_AGENT_ID);

        agent.appendUserMessage(DM_AGENT_ID, trimmed);
        agent.setStreaming(DM_AGENT_ID, true);
        agent.updateAssistantStream(DM_AGENT_ID, "");

        try {
            const finalText = await runDmTurn(priorHistory, trimmed, (partial) => {
                useAgentStore.getState().updateAssistantStream(DM_AGENT_ID, partial);
            });

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
        } catch (e: any) {
            const message = typeof e?.message === "string"
                ? e.message
                : "DM turn failed. Check OpenAI key and try again.";
            setError(message);
            useAgentStore.getState().updateAssistantStream(
                DM_AGENT_ID,
                `*The narrator's voice falters for a moment.* (${message})`,
            );
        } finally {
            useAgentStore.getState().setStreaming(DM_AGENT_ID, false);
        }
    };

    const clear = () => {
        useAgentStore.getState().clearHistory(DM_AGENT_ID);
        setError(null);
        setInput("");
    };

    return (
        <div
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 440,
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
                    <GiCrown style={{ fontSize: 28, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>Dungeon Master</span>
                        <span style={{ fontSize: 10, color: "#6b5c4c", lineHeight: 1.1 }}>AI narrator / referee for the current campaign</span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Close DM panel">
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
                    minHeight: 240,
                    maxHeight: 420,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                {history.length === 0 && !streaming && (
                    <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 24, fontSize: 12 }}>
                        <GiCrown style={{ fontSize: 32, opacity: 0.4 }} />
                        <div style={{ marginTop: 6 }}>Tell the DM what your character is doing — or simply ask it to set the scene.</div>
                        <div style={{ marginTop: 4, opacity: 0.7 }}>
                            <em>"Set the opening scene."</em> · <em>"Я осматриваю общий зал таверны."</em> · <em>"What do we see when we ride into Phandalin?"</em>
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
                                    <Tooltip content="Insert this narration at the editor cursor (or append at the end if no cursor)" closeDelay={0}>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            startContent={<GiScrollQuill />}
                                            onClick={() => insertTextAtCursor(m.content)}
                                            style={{
                                                height: 24,
                                                minHeight: 24,
                                                fontSize: 10,
                                                background: "#fffbf0",
                                                border: "1px solid #d4c5a0",
                                            }}
                                        >
                                            Insert into session
                                        </Button>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {pendingTickEvents.length > 0 && !streaming && (
                <div style={{ fontSize: 11, color: "#3a2a2a", background: "#fff1c8", padding: 6, borderRadius: 6, lineHeight: 1.35, border: "1px solid #d4c5a0" }}>
                    🌍 <strong>{pendingTickEvents.length}</strong> off-screen event{pendingTickEvents.length === 1 ? "" : "s"} waiting — the DM will weave {pendingTickEvents.length === 1 ? "it" : "them"} into the next narration.
                </div>
            )}

            {lastMirrored.length > 0 && !streaming && (
                <div style={{ fontSize: 11, color: "#3a2a2a", background: "#e6f0d2", padding: 6, borderRadius: 6, lineHeight: 1.35 }}>
                    🪶 Mirrored DM-narrated lines into the chat history of:{" "}
                    <strong>{lastMirrored.join(", ")}</strong>.{" "}
                    Click those entity nodes to continue the conversation.
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
                    placeholder="Describe what your party does — or ask the DM to set the next scene…"
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
                    aria-label="Send to DM"
                >
                    <IoSend />
                </Button>
                <Tooltip content="Clear DM conversation" closeDelay={0}>
                    <Button
                        size="sm"
                        isIconOnly
                        variant="light"
                        onClick={clear}
                        isDisabled={streaming || history.length === 0}
                        style={{ height: 36 }}
                        aria-label="Clear DM conversation"
                    >
                        <GiBroom />
                    </Button>
                </Tooltip>
            </div>
        </div>
    );
}
