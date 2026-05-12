import { create } from "zustand";
import { AiProvider, AiProviderId } from "../model/ai/types";
import { OpenAIProvider } from "../model/ai/OpenAIProvider";
import { OllamaProvider } from "../model/ai/OllamaProvider";
import { AnthropicProvider } from "../model/ai/AnthropicProvider";
import { FallbackProvider } from "../model/ai/FallbackProvider";

const STORAGE_KEY = "eclipse_dnd_ai_config_v2";

interface PersistedConfig {
    providerId: AiProviderId;
    ollamaBaseUrl: string;
    ollamaModel: string;
    openaiModel: string;
    anthropicApiKey: string;
    anthropicModel: string;
    /** When true, currentProvider() returns a FallbackProvider that tries
     *  the active provider first and then the remaining configured ones. */
    useFallback: boolean;
}

const DEFAULT_CONFIG: PersistedConfig = {
    providerId: "openai",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
    openaiModel: "gpt-4o-2024-08-06",
    anthropicApiKey: "",
    anthropicModel: "claude-opus-4-7",
    useFallback: false,
};

function loadConfig(): PersistedConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_CONFIG;
        const parsed = JSON.parse(raw);
        const providerId: AiProviderId =
            parsed.providerId === "ollama" || parsed.providerId === "anthropic" ? parsed.providerId : "openai";
        return {
            providerId,
            ollamaBaseUrl: typeof parsed.ollamaBaseUrl === "string" ? parsed.ollamaBaseUrl : DEFAULT_CONFIG.ollamaBaseUrl,
            ollamaModel: typeof parsed.ollamaModel === "string" ? parsed.ollamaModel : DEFAULT_CONFIG.ollamaModel,
            openaiModel: typeof parsed.openaiModel === "string" ? parsed.openaiModel : DEFAULT_CONFIG.openaiModel,
            anthropicApiKey: typeof parsed.anthropicApiKey === "string" ? parsed.anthropicApiKey : "",
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

interface AiConfigState extends PersistedConfig {
    setProviderId: (id: AiProviderId) => void;
    setOllamaBaseUrl: (url: string) => void;
    setOllamaModel: (model: string) => void;
    setOpenaiModel: (model: string) => void;
    setAnthropicApiKey: (key: string) => void;
    setAnthropicModel: (model: string) => void;
    setUseFallback: (value: boolean) => void;
    /** Build a fresh provider instance (or fallback chain) from current config. */
    getProvider: () => AiProvider;
}

function snapshot(state: PersistedConfig): PersistedConfig {
    return {
        providerId: state.providerId,
        ollamaBaseUrl: state.ollamaBaseUrl,
        ollamaModel: state.ollamaModel,
        openaiModel: state.openaiModel,
        anthropicApiKey: state.anthropicApiKey,
        anthropicModel: state.anthropicModel,
        useFallback: state.useFallback,
    };
}

function buildProviderFor(id: AiProviderId, state: PersistedConfig): AiProvider {
    if (id === "ollama") return new OllamaProvider(state.ollamaBaseUrl, state.ollamaModel);
    if (id === "anthropic") return new AnthropicProvider(state.anthropicApiKey, state.anthropicModel);
    return new OpenAIProvider();
}

export const useAiConfigStore = create<AiConfigState>((set, get) => {
    const initial = loadConfig();

    const update = (patch: Partial<PersistedConfig>) => {
        const next = { ...snapshot(get()), ...patch };
        persist(next);
        set(patch);
    };

    return {
        ...initial,

        setProviderId: (providerId) => update({ providerId }),
        setOllamaBaseUrl: (ollamaBaseUrl) => update({ ollamaBaseUrl }),
        setOllamaModel: (ollamaModel) => update({ ollamaModel }),
        setOpenaiModel: (openaiModel) => update({ openaiModel }),
        setAnthropicApiKey: (anthropicApiKey) => update({ anthropicApiKey }),
        setAnthropicModel: (anthropicModel) => update({ anthropicModel }),
        setUseFallback: (useFallback) => update({ useFallback }),

        getProvider: () => {
            const state = get();
            const primary = buildProviderFor(state.providerId, state);

            if (!state.useFallback) return primary;

            // Build the chain: primary first, then the remaining real providers
            // for which we have enough config to attempt a call.
            const order: AiProviderId[] = ["openai", "ollama", "anthropic"];
            const others = order.filter((p) => p !== state.providerId);

            const eligible = others.filter((p) => {
                if (p === "openai") return true; // openai key may be in env / hash, always try
                if (p === "ollama") return state.ollamaBaseUrl.length > 0;
                if (p === "anthropic") return state.anthropicApiKey.length > 0;
                return false;
            });

            const chain: AiProvider[] = [primary, ...eligible.map((p) => buildProviderFor(p, state))];
            return new FallbackProvider(chain);
        },
    };
});

export function currentProvider(): AiProvider {
    return useAiConfigStore.getState().getProvider();
}

export function currentModel(): string {
    const s = useAiConfigStore.getState();
    if (s.providerId === "ollama") return s.ollamaModel;
    if (s.providerId === "anthropic") return s.anthropicModel;
    return s.openaiModel;
}
