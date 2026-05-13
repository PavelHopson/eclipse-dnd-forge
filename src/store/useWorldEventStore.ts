import { create } from "zustand";
import { WorldTickEvent } from "../model/agents/WorldTickAgent";

const STORAGE_KEY = "eclipse_dnd_world_events_v1";
const MAX_EVENTS = 200; // hard cap so the log can never grow without bound

interface PersistedShape {
    events: WorldTickEvent[];
    insertedIds: string[];
}

function loadPersisted(): PersistedShape {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { events: [], insertedIds: [] };
        const parsed = JSON.parse(raw);
        return {
            events: Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : [],
            insertedIds: Array.isArray(parsed.insertedIds) ? parsed.insertedIds : [],
        };
    } catch {
        return { events: [], insertedIds: [] };
    }
}

function persist(state: PersistedShape) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            events: state.events.slice(-MAX_EVENTS),
            insertedIds: state.insertedIds,
        }));
    } catch {
        // ignore — localStorage may be unavailable
    }
}

interface WorldEventState {
    events: WorldTickEvent[];
    insertedIds: string[];
    running: boolean;
    currentTickId: string | null;

    appendEvent: (event: WorldTickEvent) => void;
    markInserted: (eventId: string) => void;
    clearEvents: () => void;
    setRunning: (running: boolean, tickId?: string | null) => void;
    isInserted: (eventId: string) => boolean;
    /** Latest tick's events, ordered by createdAt asc. */
    getCurrentTickEvents: () => WorldTickEvent[];
}

export const useWorldEventStore = create<WorldEventState>((set, get) => {
    const initial = loadPersisted();
    return {
        events: initial.events,
        insertedIds: initial.insertedIds,
        running: false,
        currentTickId: null,

        appendEvent: (event) => {
            const next = [...get().events, event].slice(-MAX_EVENTS);
            persist({ events: next, insertedIds: get().insertedIds });
            set({ events: next });
        },

        markInserted: (eventId) => {
            if (get().insertedIds.includes(eventId)) return;
            const next = [...get().insertedIds, eventId];
            persist({ events: get().events, insertedIds: next });
            set({ insertedIds: next });
        },

        clearEvents: () => {
            persist({ events: [], insertedIds: [] });
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
    };
});
