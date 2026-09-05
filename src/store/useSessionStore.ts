import { create } from "zustand";
import { campaignRepository, campaignResourceStorage } from "../model/dnd/campaignStorage";
import { readSessionArchive } from "../model/dnd/sessionArchive";

const STORAGE_KEY = "eclipse_dnd_sessions_v1";
const MAX_SESSIONS = 100;

export interface CampaignSession {
    id: string;
    /** Display name. Default pattern: "Session N — first 4 words of the text". */
    name: string;
    /** Wall-clock when the session was started (or archived from current). */
    startedAt: number;
    /** Wall-clock when the session was ended / archived. */
    endedAt?: number;
    /** Frozen copy of the session text at the moment of archival. */
    text: string;
    /** AI-generated 2-4 sentence recap. May be empty if generation failed
     *  or was skipped — DM-prompt context simply omits empty recaps. */
    recap?: string;
}

interface PersistedShape {
    sessions: CampaignSession[];
    /** Number to seed the next session's default name. Monotonically increases
     *  across End-session actions; reset by Clear-history. */
    nextSessionNumber: number;
}

const DEFAULT: PersistedShape = { sessions: [], nextSessionNumber: 1 };

function load(): PersistedShape {
    try {
        const raw = campaignResourceStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT;
        return readSessionArchive(raw);
    } catch {
        campaignRepository().blockResource(STORAGE_KEY);
        return DEFAULT;
    }
}

function persist(state: PersistedShape): string | null {
    try {
        campaignResourceStorage.setItem(STORAGE_KEY, JSON.stringify(readSessionArchive(JSON.stringify({
            sessions: state.sessions.slice(-MAX_SESSIONS),
            nextSessionNumber: state.nextSessionNumber,
        }))));
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : "Не удалось записать архив. Текст не очищен.";
    }
}

interface SessionState extends PersistedShape {
    storageError: string | null;
    archiveCurrentSession: (params: { name: string; text: string; recap?: string }) => CampaignSession | null;
    updateRecap: (sessionId: string, recap: string) => void;
    removeSession: (sessionId: string) => void;
    clearAll: () => void;
    /** Most-recent N sessions, oldest-first (caller wants chronological order
     *  for prompt injection). Returns empty when nothing archived yet. */
    getRecentSessions: (n: number) => CampaignSession[];
}

export const useSessionStore = create<SessionState>((set, get) => {
    const initial = load();

    return {
        ...initial,
        storageError: null,

        archiveCurrentSession: ({ name, text, recap }) => {
            const session: CampaignSession = {
                id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name,
                startedAt: Date.now(),
                endedAt: Date.now(),
                text,
                recap,
            };
            const sessions = [...get().sessions, session].slice(-MAX_SESSIONS);
            const nextSessionNumber = get().nextSessionNumber + 1;
            const storageError = persist({ sessions, nextSessionNumber });
            if (storageError) { set({ storageError }); return null; }
            set({ sessions, nextSessionNumber, storageError: null });
            return session;
        },

        updateRecap: (sessionId, recap) => {
            const sessions = get().sessions.map((s) => (s.id === sessionId ? { ...s, recap } : s));
            const storageError = persist({ sessions, nextSessionNumber: get().nextSessionNumber });
            if (storageError) { set({ storageError }); return; }
            set({ sessions, storageError: null });
        },

        removeSession: (sessionId) => {
            const sessions = get().sessions.filter((s) => s.id !== sessionId);
            const storageError = persist({ sessions, nextSessionNumber: get().nextSessionNumber });
            if (storageError) { set({ storageError }); return; }
            set({ sessions, storageError: null });
        },

        clearAll: () => {
            const storageError = persist(DEFAULT);
            if (storageError) { set({ storageError }); return; }
            set({ ...DEFAULT, storageError: null });
        },

        getRecentSessions: (n) => {
            const all = get().sessions;
            if (n <= 0) return [];
            return all.slice(-n);
        },
    };
});
