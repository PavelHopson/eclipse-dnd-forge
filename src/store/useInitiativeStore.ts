import { create } from "zustand";
import { campaignRepository, campaignResourceStorage } from "../model/dnd/campaignStorage";
import { readInitiativeState } from "../model/dnd/campaignResourceValidation";

const STORAGE_KEY = "eclipse_dnd_initiative_v1";

export interface InitiativeEntry {
    /** Stable id — `entityNode.id` when sourced from the world graph, or a
     *  generated id for ad-hoc rows (NPC the DM made up mid-fight). */
    id: string;
    /** Display name. Sourced from the entity node or typed inline. */
    name: string;
    /** Initiative roll for this round (1-30 typical). */
    initiative: number;
    /** Optional: ties back to a real entity node, so the panel can pull
     *  live HP / kind / role from useModelStore for richer display. */
    entityId?: string;
    /** Optional: tracked HP for this fight. UI lets DM edit. */
    hp?: number;
    /** Optional: notes (concentration, conditions, etc). */
    notes?: string;
}

interface PersistedShape {
    entries: InitiativeEntry[];
    activeIndex: number;
    round: number;
    /** Whether the combat is currently running (vs configured but not started). */
    active: boolean;
}

const DEFAULT: PersistedShape = { entries: [], activeIndex: 0, round: 0, active: false };

function load(): PersistedShape {
    try {
        const raw = campaignResourceStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT;
        const parsed = readInitiativeState(raw);
        return {
            entries: Array.isArray(parsed.entries) ? parsed.entries : [],
            activeIndex: typeof parsed.activeIndex === "number" ? parsed.activeIndex : 0,
            round: typeof parsed.round === "number" ? parsed.round : 0,
            active: !!parsed.active,
        };
    } catch {
        campaignRepository().blockResource(STORAGE_KEY);
        return DEFAULT;
    }
}

function persist(state: PersistedShape) {
    try {
        const raw = JSON.stringify(state);
        readInitiativeState(raw);
        campaignResourceStorage.setItem(STORAGE_KEY, raw);
        return true;
    } catch (error) {
        campaignRepository().reportError(error);
        return false;
    }
}

interface InitiativeState extends PersistedShape {
    addEntry: (entry: InitiativeEntry) => void;
    removeEntry: (id: string) => void;
    updateEntry: (id: string, patch: Partial<InitiativeEntry>) => void;
    /** Sort entries descending by initiative, set activeIndex = 0, round = 1, active = true. */
    startCombat: () => void;
    /** Step to the next turn; on wrap, increments round. */
    nextTurn: () => void;
    /** End combat — keeps entries for inspection but clears active/round/index. */
    endCombat: () => void;
    clearAll: () => void;
}

export const useInitiativeStore = create<InitiativeState>((set, get) => {
    const initial = load();

    const snapshot = (): PersistedShape => ({
        entries: get().entries,
        activeIndex: get().activeIndex,
        round: get().round,
        active: get().active,
    });

    return {
        ...initial,

        addEntry: (entry) => {
            const next = [...get().entries, entry];
            if (!persist({ ...snapshot(), entries: next })) return;
            set({ entries: next });
        },

        removeEntry: (id) => {
            const next = get().entries.filter((e) => e.id !== id);
            // If the removed entry was at or before activeIndex, shift the marker.
            let activeIndex = get().activeIndex;
            const removedIdx = get().entries.findIndex((e) => e.id === id);
            if (removedIdx >= 0 && removedIdx < activeIndex) activeIndex--;
            if (activeIndex >= next.length) activeIndex = 0;
            if (!persist({ ...snapshot(), entries: next, activeIndex })) return;
            set({ entries: next, activeIndex });
        },

        updateEntry: (id, patch) => {
            const next = get().entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
            if (!persist({ ...snapshot(), entries: next })) return;
            set({ entries: next });
        },

        startCombat: () => {
            const sorted = [...get().entries].sort((a, b) => b.initiative - a.initiative);
            if (!persist({ entries: sorted, activeIndex: 0, round: 1, active: true })) return;
            set({ entries: sorted, activeIndex: 0, round: 1, active: true });
        },

        nextTurn: () => {
            const len = get().entries.length;
            if (len === 0) return;
            let activeIndex = get().activeIndex + 1;
            let round = get().round;
            if (activeIndex >= len) {
                activeIndex = 0;
                round = round + 1;
            }
            if (!persist({ ...snapshot(), activeIndex, round })) return;
            set({ activeIndex, round });
        },

        endCombat: () => {
            if (!persist({ ...snapshot(), active: false, activeIndex: 0, round: 0 })) return;
            set({ active: false, activeIndex: 0, round: 0 });
        },

        clearAll: () => {
            if (!persist(DEFAULT)) return;
            set(DEFAULT);
        },
    };
});
