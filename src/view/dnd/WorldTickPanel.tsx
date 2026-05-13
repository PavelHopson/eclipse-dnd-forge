import { Button, Select, SelectItem, Tooltip } from "@nextui-org/react";
import { useState } from "react";
import { GiBroom, GiHourglass, GiScrollQuill, GiSandsOfTime } from "react-icons/gi";
import { IoClose } from "react-icons/io5";
import { useModelStore } from "../../model/Model";
import { WorldTickEvent, runWorldTick } from "../../model/agents/WorldTickAgent";
import { appendNpcQuoteToSession, appendParagraphToSession, insertNpcQuoteAtCursor, insertTextAtCursor } from "../../model/agents/sessionInjector";
import { useAgentStore } from "../../store/useAgentStore";
import { WORLD_TICK_INTERVAL_LABELS, WorldTickInterval, useWorldEventStore } from "../../store/useWorldEventStore";

interface WorldTickPanelProps {
    onClose: () => void;
}

export default function WorldTickPanel({ onClose }: WorldTickPanelProps) {
    const events = useWorldEventStore((s) => s.events);
    const running = useWorldEventStore((s) => s.running);
    const currentTickId = useWorldEventStore((s) => s.currentTickId);
    const isInsertedFn = useWorldEventStore((s) => s.isInserted);
    const autoTickInterval = useWorldEventStore((s) => s.autoTickInterval);
    const setAutoTickInterval = useWorldEventStore((s) => s.setAutoTickInterval);
    const lastAutoTickAt = useWorldEventStore((s) => s.lastAutoTickAt);

    const entityNodes = useModelStore((s) => s.entityNodes);

    const [error, setError] = useState<string | null>(null);

    // Eligibility info — same predicate as the runner, computed for the UI banner.
    const eligibleEntities = entityNodes.filter((n) => {
        const d = n.data as any;
        return (d.kind === "npc" || d.kind === "monster" || d.kind === "faction")
            && typeof d.goal === "string"
            && d.goal.length > 0;
    });

    const currentTickEvents = currentTickId
        ? events.filter((e) => e.tickId === currentTickId)
        : events.slice(-Math.max(eligibleEntities.length, 1) * 2); // show recent if no current tick

    const startTick = async () => {
        if (running) return;
        setError(null);

        // Pre-generate the tickId so the store's "current tick" filter
        // activates synchronously, before the first event lands.
        const tickId = `tick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        useWorldEventStore.getState().setRunning(true, tickId);

        try {
            await runWorldTick({
                tickId,
                onEventCommitted: (event) => {
                    useWorldEventStore.getState().appendEvent(event);

                    // Mirror each off-screen action into the entity's chat history,
                    // so a later "Talk to that NPC" picks up what they did.
                    if (event.action) {
                        const agentStore = useAgentStore.getState();
                        const existing = agentStore.getHistory(event.entityId);
                        const hasTickMarker = existing.some(
                            (m) => m.role === "user" && m.content.startsWith("(Off-screen tick:"),
                        );
                        if (!hasTickMarker) {
                            agentStore.appendUserMessage(
                                event.entityId,
                                "(Off-screen tick: the following lines describe what you did between sessions.)",
                            );
                        }
                        const combined = event.consequence
                            ? `${event.action} (${event.consequence})`
                            : event.action;
                        agentStore.appendAssistantMessage(event.entityId, combined);
                    }
                },
            });
            // Stamp lastAutoTickAt so the auto-scheduler doesn't immediately
            // re-fire after this manual tick.
            useWorldEventStore.getState().markAutoTicked();
        } catch (e: any) {
            setError(typeof e?.message === "string" ? e.message : "World tick failed.");
        } finally {
            useWorldEventStore.getState().setRunning(false);
        }
    };

    const clear = () => {
        useWorldEventStore.getState().clearEvents();
        setError(null);
    };

    const insertEvent = (event: WorldTickEvent, atCursor: boolean) => {
        if (!event.action) return;
        const quoted = event.consequence
            ? `${event.action} — *${event.consequence}*`
            : event.action;
        if (atCursor) {
            insertNpcQuoteAtCursor(event.entityName, quoted);
        } else {
            appendNpcQuoteToSession(event.entityName, quoted);
        }
        useWorldEventStore.getState().markInserted(event.id);
    };

    const insertAllConsequences = () => {
        const toInsert = currentTickEvents.filter((e) => e.action && !isInsertedFn(e.id));
        if (toInsert.length === 0) return;

        const block = toInsert
            .map((e) => `**${e.entityName}:** ${e.action}${e.consequence ? ` — *${e.consequence}*` : ""}`)
            .join("\n\n");

        // Use the standalone helper so the block lands as a single paragraph
        // with all events grouped — easier to scan once promoted.
        const header = "**Between sessions —** the world moved on:";
        const finalBlock = `${header}\n\n${block}`;

        if (document.activeElement && (document.activeElement as HTMLElement).closest('[contenteditable="true"]')) {
            insertTextAtCursor(finalBlock);
        } else {
            appendParagraphToSession(finalBlock);
        }

        for (const e of toInsert) useWorldEventStore.getState().markInserted(e.id);
    };

    return (
        <div
            style={{
                position: "absolute",
                top: 60,
                right: 16,
                zIndex: 1000,
                width: 460,
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
                    <GiSandsOfTime style={{ fontSize: 28, color: "#7a1f1f" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, color: "#2a1a1a", lineHeight: 1.1 }}>World Tick</span>
                        <span style={{ fontSize: 10, color: "#6b5c4c", lineHeight: 1.1 }}>
                            Advance every NPC / monster / faction with a goal by one off-screen action
                        </span>
                    </div>
                </div>
                <Button size="sm" variant="light" isIconOnly onClick={onClose} aria-label="Close World Tick panel">
                    <IoClose />
                </Button>
            </div>

            {/* Eligibility + run */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: "#f0e4c8", borderRadius: 6 }}>
                <GiHourglass style={{ fontSize: 18, color: "#7a1f1f" }} />
                <span style={{ fontSize: 12, color: "#3a2a2a", flex: 1 }}>
                    {eligibleEntities.length === 0
                        ? "No entities with a goal yet — give NPCs / monsters / factions a goal first (generator does this automatically; seed campaigns are pre-filled)."
                        : <>Will tick <strong>{eligibleEntities.length}</strong> {eligibleEntities.length === 1 ? "entity" : "entities"} (NPCs, monsters, factions with a goal).</>}
                </span>
                <Button
                    size="sm"
                    color="primary"
                    isLoading={running}
                    isDisabled={running || eligibleEntities.length === 0}
                    onClick={startTick}
                    style={{ background: "#7a1f1f", color: "white" }}
                >
                    {running ? "Ticking…" : "Advance the world"}
                </Button>
            </div>

            {/* Auto-tick scheduling */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#3a2a2a" }}>
                <span style={{ whiteSpace: "nowrap" }}>Auto-advance:</span>
                <Select
                    size="sm"
                    variant="faded"
                    selectedKeys={[autoTickInterval]}
                    onChange={(e) => setAutoTickInterval(e.target.value as WorldTickInterval)}
                    aria-label="World tick interval"
                    style={{ minWidth: 180 }}
                    classNames={{ trigger: "!min-h-[32px] h-[32px]" }}
                >
                    {(Object.keys(WORLD_TICK_INTERVAL_LABELS) as WorldTickInterval[]).map((key) => (
                        <SelectItem key={key} value={key} textValue={WORLD_TICK_INTERVAL_LABELS[key]}>
                            {WORLD_TICK_INTERVAL_LABELS[key]}
                        </SelectItem>
                    ))}
                </Select>
                {autoTickInterval !== "off" && (
                    <span style={{ fontSize: 11, color: "#6b5c4c", fontStyle: "italic" }}>
                        {lastAutoTickAt > 0
                            ? `Last tick: ${new Date(lastAutoTickAt).toLocaleTimeString()}`
                            : "Will tick on next interval."}
                    </span>
                )}
            </div>

            {error && (
                <div style={{ fontSize: 11, color: "#7a1f1f", background: "#fde2e2", padding: 6, borderRadius: 6 }}>
                    {error}
                </div>
            )}

            {/* Event log */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    background: "#fffefb",
                    border: "1px solid #e8dcc0",
                    borderRadius: 6,
                    padding: 8,
                    minHeight: 220,
                    maxHeight: 400,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}
            >
                {currentTickEvents.length === 0 && !running && (
                    <div style={{ color: "#9a8a7a", fontStyle: "italic", textAlign: "center", padding: 24, fontSize: 12 }}>
                        <GiSandsOfTime style={{ fontSize: 32, opacity: 0.4 }} />
                        <div style={{ marginTop: 6 }}>Click <strong>Advance the world</strong> to simulate what every NPC, monster and faction did off-screen.</div>
                        <div style={{ marginTop: 4, opacity: 0.7 }}>
                            Each event is also mirrored into that entity's chat history.
                        </div>
                    </div>
                )}
                {currentTickEvents.map((e) => {
                    const inserted = isInsertedFn(e.id);
                    const hasParseFail = !e.action && !!e.raw;
                    return (
                        <div
                            key={e.id}
                            style={{
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: hasParseFail ? "#fde2e2" : (inserted ? "#e6f0d2" : "#f0e4c8"),
                                color: "#2a1a1a",
                                fontSize: 12,
                                lineHeight: 1.45,
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                                <span style={{ fontWeight: 700 }}>{e.entityName}</span>
                                {inserted && <span style={{ fontSize: 9, opacity: 0.7 }}>✓ inserted</span>}
                            </div>
                            {e.action && (
                                <div>{e.action}</div>
                            )}
                            {e.consequence && (
                                <div style={{ fontStyle: "italic", color: "#5a4a3a" }}>↳ {e.consequence}</div>
                            )}
                            {hasParseFail && (
                                <div style={{ fontSize: 11, color: "#7a1f1f" }}>
                                    Could not parse JSON output. Raw reply:
                                    <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontSize: 11, background: "#fffbf0", padding: 4, borderRadius: 4 }}>{e.raw}</pre>
                                </div>
                            )}
                            {e.action && !inserted && (
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <Tooltip content="Insert this event into the session text at the cursor (or append if no cursor)" closeDelay={0}>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            startContent={<GiScrollQuill />}
                                            onClick={() => insertEvent(e, true)}
                                            style={{ height: 22, minHeight: 22, fontSize: 10, background: "#fffbf0", border: "1px solid #d4c5a0" }}
                                        >
                                            Insert
                                        </Button>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bottom actions */}
            <div style={{ display: "flex", gap: 6 }}>
                <Tooltip content="Promote every uninserted event into a single session-text block" closeDelay={0}>
                    <Button
                        size="sm"
                        variant="flat"
                        startContent={<GiScrollQuill />}
                        onClick={insertAllConsequences}
                        isDisabled={running || currentTickEvents.filter((e) => e.action && !isInsertedFn(e.id)).length === 0}
                        style={{ fontSize: 11 }}
                    >
                        Insert all into session
                    </Button>
                </Tooltip>
                <div style={{ flex: 1 }} />
                <Tooltip content="Clear the event log (the entities' chat-history mirrors stay)" closeDelay={0}>
                    <Button
                        size="sm"
                        isIconOnly
                        variant="light"
                        onClick={clear}
                        isDisabled={running || events.length === 0}
                        aria-label="Clear event log"
                    >
                        <GiBroom />
                    </Button>
                </Tooltip>
            </div>
        </div>
    );
}
