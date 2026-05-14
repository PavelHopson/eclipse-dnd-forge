import { create } from "zustand";

/**
 * Phase of the autonomous play loop.
 *
 *   idle            — Play mode not started; the panel shows its start screen.
 *   awaiting-player — the loop is waiting for the player's next free-text action.
 *   dm-narrating    — the DM agent is streaming a narrative beat.
 *   npc-reacting    — one or more NPC agents are streaming in-character reactions.
 *
 * The loop is always player-gated: every cycle returns to `awaiting-player`, so
 * there is no runaway-conversation risk — the only fan-out cap that matters is
 * the per-turn NPC limit in `DmOrchestrator`.
 */
export type GameLoopPhase = "idle" | "awaiting-player" | "dm-narrating" | "npc-reacting";

export type GameLoopEntryKind = "player" | "dm" | "npc";

export interface GameLoopEntry {
    id: string;
    kind: GameLoopEntryKind;
    /** Display name of the speaker. Player entries carry none. */
    speaker?: string;
    /** For npc entries — the originating `EntityNode.id`, so the log can deep-link. */
    speakerId?: string;
    content: string;
    createdAt: number;
}

interface GameLoopState {
    phase: GameLoopPhase;
    /** Ordered transcript of the current play session: player / DM / NPC beats. */
    turnLog: GameLoopEntry[];
    /** How many full player→DM→NPC cycles have completed. */
    turn: number;
    /** Id of the entry currently being streamed into, or null when idle. */
    activeStreamId: string | null;

    /** Enter Play mode (idle → awaiting-player). Keeps any existing transcript. */
    start(): void;
    /** Leave Play mode but keep the transcript (panel close ≠ end game). */
    stop(): void;
    /** End the game — wipe transcript and turn counter. */
    reset(): void;
    setPhase(phase: GameLoopPhase): void;
    setActiveStreamId(id: string | null): void;
    incrementTurn(): void;
    /** Append an entry; returns its generated id so the orchestrator can stream into it. */
    appendEntry(entry: Omit<GameLoopEntry, "id" | "createdAt">): string;
    /** Overwrite the content of an entry mid-stream. */
    updateStreamingEntry(id: string, content: string): void;
}

let entrySeq = 0;
function nextId(): string {
    entrySeq += 1;
    return `gl-${Date.now().toString(36)}-${entrySeq}`;
}

/**
 * Play-loop state. Deliberately NOT persisted to localStorage — a play session
 * is ephemeral working state; the canonical record is the Slate session text
 * (beats are promoted into it via the per-entry "Insert into session" buttons).
 * This mirrors `useAgentStore`, which is also session-scoped, not persisted.
 */
export const useGameLoopStore = create<GameLoopState>((set, get) => ({
    phase: "idle",
    turnLog: [],
    turn: 0,
    activeStreamId: null,

    start: () => set({ phase: "awaiting-player" }),
    stop: () => set({ phase: "idle", activeStreamId: null }),
    reset: () => set({ phase: "idle", turnLog: [], turn: 0, activeStreamId: null }),
    setPhase: (phase) => set({ phase }),
    setActiveStreamId: (activeStreamId) => set({ activeStreamId }),
    incrementTurn: () => set({ turn: get().turn + 1 }),

    appendEntry: (entry) => {
        const id = nextId();
        const full: GameLoopEntry = { ...entry, id, createdAt: Date.now() };
        set({ turnLog: [...get().turnLog, full] });
        return id;
    },

    updateStreamingEntry: (id, content) => {
        set({
            turnLog: get().turnLog.map((e) => (e.id === id ? { ...e, content } : e)),
        });
    },
}));
