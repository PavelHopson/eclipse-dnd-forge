import { create } from "zustand";
import { AiProvider, AiProviderId } from "../model/ai/types";
import { OpenAIProvider } from "../model/ai/OpenAIProvider";
import { OllamaProvider } from "../model/ai/OllamaProvider";

const STORAGE_KEY = "eclipse_dnd_ai_config_v1";

interface PersistedConfig {
    providerId: AiProviderId;
    ollamaBaseUrl: string;
    ollamaModel: string;
    openaiModel: string;
}

const DEFAULT_CONFIG: PersistedConfig = {
    providerId: "openai",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
    openaiModel: "gpt-4o-2024-08-06",
};

function loadConfig(): PersistedConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_CONFIG;
        const parsed = JSON.parse(raw);
        return {
            providerId: parsed.providerId === "ollama" ? "ollama" : "openai",
            ollamaBaseUrl: typeof parsed.ollamaBaseUrl === "string" ? parsed.ollamaBaseUrl : DEFAULT_CONFIG.ollamaBaseUrl,
            ollamaModel: typeof parsed.ollamaModel === "string" ? parsed.ollamaModel : DEFAULT_CONFIG.ollamaModel,
            openaiModel: typeof parsed.openaiModel === "string" ? parsed.openaiModel : DEFAULT_CONFIG.openaiModel,
        };
    } catch {
        return DEFAULT_CONFIG;
    }
}

function persist(config: PersistedConfig) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
        // localStorage may be unavailable (e.g. SSR / strict privacy) — silently ignore.
    }
}

interface AiConfigState extends PersistedConfig {
    setProviderId: (id: AiProviderId) => void;
    setOllamaBaseUrl: (url: string) => void;
    setOllamaModel: (model: string) => void;
    setOpenaiModel: (model: string) => void;
    /** Build a fresh provider instance from current config. */
    getProvider: () => AiProvider;
}

export const useAiConfigStore = create<AiConfigState>((set, get) => {
    const initial = loadConfig();
    return {
        ...initial,

        setProviderId: (providerId) => {
            const next = { ...get(), providerId };
            persist({
                providerId: next.providerId,
                ollamaBaseUrl: next.ollamaBaseUrl,
                ollamaModel: next.ollamaModel,
                openaiModel: next.openaiModel,
            });
            set({ providerId });
        },

        setOllamaBaseUrl: (ollamaBaseUrl) => {
            const next = { ...get(), ollamaBaseUrl };
            persist({
                providerId: next.providerId,
                ollamaBaseUrl: next.ollamaBaseUrl,
                ollamaModel: next.ollamaModel,
                openaiModel: next.openaiModel,
            });
            set({ ollamaBaseUrl });
        },

        setOllamaModel: (ollamaModel) => {
            const next = { ...get(), ollamaModel };
            persist({
                providerId: next.providerId,
                ollamaBaseUrl: next.ollamaBaseUrl,
                ollamaModel: next.ollamaModel,
                openaiModel: next.openaiModel,
            });
            set({ ollamaModel });
        },

        setOpenaiModel: (openaiModel) => {
            const next = { ...get(), openaiModel };
            persist({
                providerId: next.providerId,
                ollamaBaseUrl: next.ollamaBaseUrl,
                ollamaModel: next.ollamaModel,
                openaiModel: next.openaiModel,
            });
            set({ openaiModel });
        },

        getProvider: () => {
            const state = get();
            if (state.providerId === "ollama") {
                return new OllamaProvider(state.ollamaBaseUrl, state.ollamaModel);
            }
            return new OpenAIProvider();
        },
    };
});

/**
 * Convenience accessor — works outside React components (in agent runners).
 * Returns a fresh provider instance every call so config changes are picked
 * up without re-initialising any singleton.
 */
export function currentProvider(): AiProvider {
    return useAiConfigStore.getState().getProvider();
}

/** Active model for the current provider (used when calling streamChat). */
export function currentModel(): string {
    const s = useAiConfigStore.getState();
    return s.providerId === "ollama" ? s.ollamaModel : s.openaiModel;
}
