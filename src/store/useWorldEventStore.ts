import { create } from "zustand";
import { WorldTickEvent } from "../model/agents/WorldTickAgent";

const STORAGE_KEY = "eclipse_dnd_world_events_v1";
const MAX_EVENTS = 200; // hard cap so the log can never grow without bound

interface PersistedShape {
    events: WorldTickEvent[];
    insertedIds: string[];
    lastDmAcknowledgedAt: number;
}

function loadPersisted(): PersistedShape {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { events: [], insertedIds: [], lastDmAcknowledgedAt: 0 };
        const parsed = JSON.parse(raw);
        return {
            events: Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : [],
            insertedIds: Array.isArray(parsed.insertedIds) ? parsed.insertedIds : [],
            lastDmAcknowledgedAt: typeof parsed.lastDmAcknowledgedAt === "number" ? parsed.lastDmAcknowledgedAt : 0,
        };
    } catch {
        return { events: [], insertedIds: [], lastDmAcknowledgedAt: 0 };
    }
}

function persist(state: PersistedShape) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            events: state.events.slice(-MAX_EVENTS),
            insertedIds: state.insertedIds,
            lastDmAcknowledgedAt: state.lastDmAcknowledgedAt,
        }));
    } catch {
        // ignore — localStorage may be unavailable
    }
}

interface WorldEventState {
    events: WorldTickEvent[];
    insertedIds: string[];
    /** Timestamp (ms) of the last DM turn that already saw all events up to that
     *  point. New events with `createdAt > lastDmAcknowledgedAt` are injected
     *  into the DM system prompt as "off-screen events since your last beat".  */
    lastDmAcknowledgedAt: number;
    running: boolean;
    currentTickId: string | null;

    appendEvent: (event: WorldTickEvent) => void;
    markInserted: (eventId: string) => void;
    /** Bump `lastDmAcknowledgedAt` so the same events are not re-injected on the
     *  next DM turn. Called after a successful DM stream completes. */
    markDmAcknowledged: () => void;
    clearEvents: () => void;
    setRunning: (running: boolean, tickId?: string | null) => void;
    isInserted: (eventId: string) => boolean;
    /** Latest tick's events, ordered by createdAt asc. */
    getCurrentTickEvents: () => WorldTickEvent[];
    /** Events the DM has not yet acknowledged. Filters out malformed (no
     *  `action`) entries because they would dilute the system prompt. */
    getEventsForDm: () => WorldTickEvent[];
}

export const useWorldEventStore = create<WorldEventState>((set, get) => {
    const initial = loadPersisted();
    const snapshot = (): PersistedShape => ({
        events: get().events,
        insertedIds: get().insertedIds,
        lastDmAcknowledgedAt: get().lastDmAcknowledgedAt,
    });

    return {
        events: initial.events,
        insertedIds: initial.insertedIds,
        lastDmAcknowledgedAt: initial.lastDmAcknowledgedAt,
        running: false,
        currentTickId: null,

        appendEvent: (event) => {
            const next = [...get().events, event].slice(-MAX_EVENTS);
            persist({ ...snapshot(), events: next });
            set({ events: next });
        },

        markInserted: (eventId) => {
            if (get().insertedIds.includes(eventId)) return;
            const next = [...get().insertedIds, eventId];
            persist({ ...snapshot(), insertedIds: next });
            set({ insertedIds: next });
        },

        markDmAcknowledged: () => {
            const now = Date.now();
            persist({ ...snapshot(), lastDmAcknowledgedAt: now });
            set({ lastDmAcknowledgedAt: now });
        },

        clearEvents: () => {
            persist({ events: [], insertedIds: [], lastDmAcknowledgedAt: get().lastDmAcknowledgedAt });
            set({ events: [], insertedIds: [], currentTickId: null });
        },

        setRunning: (running, tickId) => {
            set({ running, currentTickId: running ? (tickId ?? get().currentTickId) : get().currentTickId });
        },

        isInserted: (eventId) => get().insertedIds.includes(eventId),

        getCurrentTickEvents: () => {
            const tickId = get().currentTickId;
            if (!tickId) return [];
            return get().events.filter((e) => e.tickId === tickId);
        },

        getEventsForDm: () => {
            const ackedAt = get().lastDmAcknowledgedAt;
            return get().events.filter((e) => !!e.action && e.createdAt > ackedAt);
        },
    };
});
