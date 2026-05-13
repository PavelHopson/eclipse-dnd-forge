import { Button, Input, Tooltip } from "@nextui-org/react";
import { useState } from "react";
import { GiBookmarklet, GiBroom, GiScrollUnfurled } from "react-icons/gi";
import { IoClose, IoTrash } from "react-icons/io5";
import { useModelStore } from "../../model/Model";
import { generateSessionRecap } from "../../model/agents/SessionRecapAgent";
import { useSessionStore } from "../../store/useSessionStore";

interface SessionsPanelProps {
    onClose: () => void;
}

function defaultSessionName(nextNumber: number, currentText: string): string {
    const firstWords = currentText.trim().split(/\s+/).slice(0, 5).join(" ");
    if (firstWords.length === 0) return `Session ${nextNumber}`;
    const clipped = firstWords.length > 40 ? firstWords.slice(0, 40) + "…" : firstWords;
    return `Session ${nextNumber} — ${clipped}`;
}

export default function SessionsPanel({ onClose }: SessionsPanelProps) {
    const sessions = useSessionStore((s) => s.sessions);
    const nextSessionNumber = useSessionStore((s) => s.nextSessionNumber);

    const currentText = useModelStore((s) => s.text);

    const [sessionName, setSessionName] = useState("");
    const [skipRecap, setSkipRecap] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [regeneratingFor, setRegeneratingFor] = useState<string | null>(null);

    const proposedName = sessionName.trim() || defaultSessionName(nextSessionNumber, currentText);

    const endCurrent = async () => {
        if (isEnding) return;
        if (currentText.trim().length === 0) {
            setError("Current session text is empty — nothing to archive.");
            return;
        }
        setError(null);
        setIsEnding(true);

        try {
            let recap: string | undefined;
            if (!skipRecap) {
                try {
                    recap = await generateSessionRecap(currentText, proposedName);
                } catch (e: any) {
                    // Don't block archival on recap failure — store the session
                    // and surface a message so the user can retry later.
                    setError(`Recap generation failed: ${e?.message ?? e}. Session was archived without a recap; you can regenerate from the list below.`);
                }
            }

            useSessionStore.getState().archiveCurrentSession({
                name: proposedName,
                text: currentText,
                recap,
            });

            // Reset the session text — keep entities, locations, world events
            // (they are the persistent campaign world; sessions are chapters).
            useModelStore.getState().setTextState([{ children: [{ text: "" }] }] as any, true, true);
            useModelStore.getState().setIsStale(false);
            setSessionName("");
        } finally {
            setIsEnding(false);
        }
    };

    const regenerateRecap = async (sessionId: string) => {
        const target = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
        if (!target) return;
        setRegeneratingFor(sessionId);
        try {
            const recap = await generateSessionRecap(target.text, target.name);
            useSessionStore.getState().updateRecap(sessionId, recap);
        } catch (e: any) {
            setError(`Recap regeneration failed: ${e?.message ?? e}`);
        } finally {
            setRegeneratingFor(null);
        }
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <GiBookmarklet style={{ fontSize: 24, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>Sessions</span>
                        <span style={{ fontSize: 10, color: "#6b5c4c", lineHeight: 1.1 }}>
                            Archive chapters · DM agent uses recaps as "Previously…" context
                        </span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Close sessions panel">
                    <IoClose />
                </Button>
            </div>

            {/* End-current-session block */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, background: "#f0e4c8", borderRadius: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2a1a1a" }}>End current session</span>
                <Input
                    size="sm"
                    variant="faded"
                    label="Session name"
                    placeholder={defaultSessionName(nextSessionNumber, currentText)}
                    value={sessionName}
                    onValueChange={setSessionName}
                    isDisabled={isEnding}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#3a2a2a" }}>
                    <input type="checkbox" checked={skipRecap} onChange={(e) => setSkipRecap(e.target.checked)} disabled={isEnding} />
                    Skip recap generation (saves an API call; can regenerate later)
                </label>
                <Button
                    size="sm"
                    color="primary"
                    isLoading={isEnding}
                    isDisabled={isEnding || currentText.trim().length === 0}
                    onClick={endCurrent}
                    style={{ background: "#7a1f1f" }}
                >
                    {isEnding ? "Archiving…" : "End session & start new"}
                </Button>
            </div>

            {error && (
                <div style={{ fontSize: 11, color: "#7a1f1f", background: "#fde2e2", padding: 6, borderRadius: 6 }}>
                    {error}
                </div>
            )}

            {/* Sessions list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                {sessions.length === 0 && (
                    <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 12, fontSize: 12 }}>
                        No archived sessions yet. End the current session to start a chapter history.
                    </div>
                )}
                {[...sessions].reverse().map((s) => (
                    <div
                        key={s.id}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            padding: 8,
                            borderRadius: 6,
                            background: "#fffefb",
                            border: "1px solid #e8dcc0",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                            <span style={{ fontSize: 10, color: "#9a8a7a" }}>
                                {new Date(s.endedAt ?? s.startedAt).toLocaleString()}
                            </span>
                        </div>
                        {s.recap
                            ? (
                                <div style={{ fontSize: 12, color: "#3a2a2a", fontStyle: "italic", lineHeight: 1.4 }}>
                                    {s.recap}
                                </div>
                            )
                            : (
                                <div style={{ fontSize: 11, color: "#9a8a7a", fontStyle: "italic" }}>
                                    No recap. Click <em>Regenerate</em> to ask the AI for one.
                                </div>
                            )}
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                            <Tooltip content="Regenerate recap from the archived session text" closeDelay={0}>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    startContent={<GiScrollUnfurled />}
                                    onClick={() => regenerateRecap(s.id)}
                                    isLoading={regeneratingFor === s.id}
                                    isDisabled={regeneratingFor !== null}
                                    style={{ height: 22, minHeight: 22, fontSize: 10 }}
                                >
                                    Regenerate recap
                                </Button>
                            </Tooltip>
                            <div style={{ flex: 1 }} />
                            <Tooltip content="Remove this archived session" closeDelay={0}>
                                <Button
                                    size="sm"
                                    isIconOnly
                                    variant="light"
                                    onClick={() => useSessionStore.getState().removeSession(s.id)}
                                    style={{ minWidth: 22, height: 22, color: "#7a1f1f" }}
                                    aria-label="Remove session"
                                >
                                    <IoTrash style={{ fontSize: 12 }} />
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                ))}
            </div>

            {sessions.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Tooltip content="Wipe the session history (does not touch the current session text or the world graph)" closeDelay={0}>
                        <Button
                            size="sm"
                            variant="light"
                            startContent={<GiBroom />}
                            onClick={() => useSessionStore.getState().clearAll()}
                            style={{ fontSize: 11 }}
                        >
                            Clear history
                        </Button>
                    </Tooltip>
                </div>
            )}
        </div>
    );
}
