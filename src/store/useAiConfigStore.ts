import { create } from "zustand";
import type { AiProvider, AiProviderId } from "../model/ai/types";
import { MANAGED_AI_ENABLED } from "../model/auth/dndSession";
import {
    clearSessionCredentials,
    CloudCredentials,
    loadSessionCredentials,
    persistSessionCredentials,
} from "../model/ai/credentialStorage";

const STORAGE_KEY = "eclipse_dnd_ai_config_v2";

interface PersistedConfig {
    providerId: AiProviderId;
    ollamaBaseUrl: string;
    ollamaModel: string;
    openaiModel: string;
    anthropicModel: string;
    gatewayModel: string;
    /** When true, currentProvider() returns a FallbackProvider that tries
     *  the active provider first and then the remaining configured ones. */
    useFallback: boolean;
}

const DEFAULT_CONFIG: PersistedConfig = {
    providerId: MANAGED_AI_ENABLED ? "eclipse" : "openai",
    gatewayModel: "auto/best-chat",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
    openaiModel: "gpt-4o-2024-08-06",
    anthropicModel: "claude-opus-4-7",
    useFallback: false,
};

function loadConfig(): PersistedConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_CONFIG;
        const parsed = JSON.parse(raw);
        const providerId: AiProviderId =
            ["openai", "ollama", "anthropic", ...(MANAGED_AI_ENABLED ? ["eclipse"] : [])].includes(parsed.providerId)
                ? parsed.providerId
                : DEFAULT_CONFIG.providerId;
        return {
            providerId,
            gatewayModel: typeof parsed.gatewayModel === "string" ? parsed.gatewayModel : DEFAULT_CONFIG.gatewayModel,
            ollamaBaseUrl: typeof parsed.ollamaBaseUrl === "string" ? parsed.ollamaBaseUrl : DEFAULT_CONFIG.ollamaBaseUrl,
            ollamaModel: typeof parsed.ollamaModel === "string" ? parsed.ollamaModel : DEFAULT_CONFIG.ollamaModel,
            openaiModel: typeof parsed.openaiModel === "string" ? parsed.openaiModel : DEFAULT_CONFIG.openaiModel,
            anthropicModel: typeof parsed.anthropicModel === "string" ? parsed.anthropicModel : DEFAULT_CONFIG.anthropicModel,
            useFallback: !!parsed.useFallback,
        };
    } catch {
        return DEFAULT_CONFIG;
    }
}

function persist(config: PersistedConfig) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
        // localStorage may be unavailable — silently ignore.
    }
}

interface AiConfigState extends PersistedConfig, CloudCredentials {
    setProviderId: (id: AiProviderId) => void;
    setOllamaBaseUrl: (url: string) => void;
    setOllamaModel: (model: string) => void;
    setOpenaiModel: (model: string) => void;
    setOpenaiApiKey: (key: string) => void;
    setAnthropicApiKey: (key: string) => void;
    setAnthropicModel: (model: string) => void;
    setGatewayModel: (model: string) => void;
    setUseFallback: (value: boolean) => void;
    clearCloudCredentials: () => void;
    /** Build a fresh provider instance (or fallback chain) from current config. */
    getProvider: () => Promise<AiProvider>;
}

function snapshot(state: PersistedConfig): PersistedConfig {
    return {
        providerId: state.providerId,
        gatewayModel: state.gatewayModel,
        ollamaBaseUrl: state.ollamaBaseUrl,
        ollamaModel: state.ollamaModel,
        openaiModel: state.openaiModel,
        anthropicModel: state.anthropicModel,
        useFallback: state.useFallback,
    };
}


export const useAiConfigStore = create<AiConfigState>((set, get) => {
    const initial = loadConfig();
    const initialCredentials = loadSessionCredentials();

    const update = (patch: Partial<PersistedConfig>) => {
        const next = { ...snapshot(get()), ...patch };
        persist(next);
        set(patch);
    };

    const updateCredentials = (patch: Partial<CloudCredentials>) => {
        const next = {
            openaiApiKey: get().openaiApiKey,
            anthropicApiKey: get().anthropicApiKey,
            ...patch,
        };
        persistSessionCredentials(next);
        set(patch);
    };

    return {
        ...initial,
        ...initialCredentials,

        setProviderId: (providerId) => update({ providerId }),
        setGatewayModel: (gatewayModel) => update({ gatewayModel }),
        setOllamaBaseUrl: (ollamaBaseUrl) => update({ ollamaBaseUrl }),
        setOllamaModel: (ollamaModel) => update({ ollamaModel }),
        setOpenaiModel: (openaiModel) => update({ openaiModel }),
        setOpenaiApiKey: (openaiApiKey) => updateCredentials({ openaiApiKey }),
        setAnthropicApiKey: (anthropicApiKey) => updateCredentials({ anthropicApiKey }),
        setAnthropicModel: (anthropicModel) => update({ anthropicModel }),
        setUseFallback: (useFallback) => update({ useFallback }),
        clearCloudCredentials: () => {
            clearSessionCredentials();
            set({ openaiApiKey: "", anthropicApiKey: "" });
        },

        getProvider: async () => {
            const { buildProvider } = await import("../model/ai/providerFactory");
            return buildProvider(get());
        },
    };
});

export async function currentProvider(): Promise<AiProvider> {
    return useAiConfigStore.getState().getProvider();
}

export function currentModel(): string {
    const s = useAiConfigStore.getState();
    if (s.providerId === "eclipse") return s.gatewayModel;
    if (s.providerId === "ollama") return s.ollamaModel;
    if (s.providerId === "anthropic") return s.anthropicModel;
    return s.openaiModel;
}
