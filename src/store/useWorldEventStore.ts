import { create } from "zustand";
import { WorldTickEvent } from "../model/agents/WorldTickAgent";

const STORAGE_KEY = "eclipse_dnd_world_events_v1";
const MAX_EVENTS = 200; // hard cap so the log can never grow without bound

export type WorldTickInterval = "off" | "5min" | "15min" | "1h" | "4h";

export const WORLD_TICK_INTERVAL_MS: Record<WorldTickInterval, number> = {
    off: 0,
    "5min": 5 * 60 * 1000,
    "15min": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
};

export const WORLD_TICK_INTERVAL_LABELS: Record<WorldTickInterval, string> = {
    off: "Только вручную",
    "5min": "Каждые 5 минут",
    "15min": "Каждые 15 минут",
    "1h": "Каждый час",
    "4h": "Каждые 4 часа",
};

interface PersistedShape {
    events: WorldTickEvent[];
    insertedIds: string[];
    lastDmAcknowledgedAt: number;
    autoTickInterval: WorldTickInterval;
    lastAutoTickAt: number;
}

const INTERVAL_KEYS: WorldTickInterval[] = ["off", "5min", "15min", "1h", "4h"];

function loadPersisted(): PersistedShape {
    const defaults: PersistedShape = {
        events: [],
        insertedIds: [],
        lastDmAcknowledgedAt: 0,
        autoTickInterval: "off",
        lastAutoTickAt: 0,
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        const interval: WorldTickInterval = INTERVAL_KEYS.includes(parsed.autoTickInterval)
            ? parsed.autoTickInterval
            : "off";
        return {
            events: Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : [],
            insertedIds: Array.isArray(parsed.insertedIds) ? parsed.insertedIds : [],
            lastDmAcknowledgedAt: typeof parsed.lastDmAcknowledgedAt === "number" ? parsed.lastDmAcknowledgedAt : 0,
            autoTickInterval: interval,
            lastAutoTickAt: typeof parsed.lastAutoTickAt === "number" ? parsed.lastAutoTickAt : 0,
        };
    } catch {
        return defaults;
    }
}

function persist(state: PersistedShape) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            events: state.events.slice(-MAX_EVENTS),
            insertedIds: state.insertedIds,
            lastDmAcknowledgedAt: state.lastDmAcknowledgedAt,
            autoTickInterval: state.autoTickInterval,
            lastAutoTickAt: state.lastAutoTickAt,
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
    /** Selected auto-tick cadence. "off" = manual only (default). */
    autoTickInterval: WorldTickInterval;
    /** Last time an auto-tick (manual OR scheduled) successfully fired. Used
     *  by the auto-scheduler to compute "is it time yet?" after reload. */
    lastAutoTickAt: number;
    running: boolean;
    currentTickId: string | null;

    appendEvent: (event: WorldTickEvent) => void;
    markInserted: (eventId: string) => void;
    /** Bump `lastDmAcknowledgedAt` so the same events are not re-injected on the
     *  next DM turn. Called after a successful DM stream completes. */
    markDmAcknowledged: () => void;
    /** Set the auto-tick cadence and persist it. */
    setAutoTickInterval: (interval: WorldTickInterval) => void;
    /** Stamp `lastAutoTickAt = now`. Called by both manual and auto-fired ticks
     *  so the auto-scheduler does not double-fire right after a manual click. */
    markAutoTicked: () => void;
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
        autoTickInterval: get().autoTickInterval,
        lastAutoTickAt: get().lastAutoTickAt,
    });

    return {
        events: initial.events,
        insertedIds: initial.insertedIds,
        lastDmAcknowledgedAt: initial.lastDmAcknowledgedAt,
        autoTickInterval: initial.autoTickInterval,
        lastAutoTickAt: initial.lastAutoTickAt,
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

        setAutoTickInterval: (interval) => {
            persist({ ...snapshot(), autoTickInterval: interval });
            set({ autoTickInterval: interval });
        },

        markAutoTicked: () => {
            const now = Date.now();
            persist({ ...snapshot(), lastAutoTickAt: now });
            set({ lastAutoTickAt: now });
        },

        clearEvents: () => {
            persist({ ...snapshot(), events: [], insertedIds: [] });
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
