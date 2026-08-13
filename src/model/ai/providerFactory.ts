import type { CloudCredentials } from "./credentialStorage";
import type { AiProvider, AiProviderId } from "./types";
import { AnthropicProvider } from "./AnthropicProvider";
import { EclipseGatewayProvider } from "./EclipseGatewayProvider";
import { FallbackProvider } from "./FallbackProvider";
import { OllamaProvider } from "./OllamaProvider";
import { OpenAIProvider } from "./OpenAIProvider";

export interface ProviderRuntimeConfig extends CloudCredentials {
    providerId: AiProviderId;
    gatewayModel: string;
    ollamaBaseUrl: string;
    ollamaModel: string;
    openaiModel: string;
    anthropicModel: string;
    useFallback: boolean;
}

function buildProviderFor(id: AiProviderId, state: ProviderRuntimeConfig): AiProvider {
    if (id === "eclipse") return new EclipseGatewayProvider(state.gatewayModel);
    if (id === "ollama") return new OllamaProvider(state.ollamaBaseUrl, state.ollamaModel);
    if (id === "anthropic") return new AnthropicProvider(state.anthropicApiKey, state.anthropicModel);
    return new OpenAIProvider();
}

export function buildProvider(state: ProviderRuntimeConfig): AiProvider {
    const primary = buildProviderFor(state.providerId, state);
    if (!state.useFallback || state.providerId === "eclipse") return primary;

    const order: AiProviderId[] = ["eclipse", "openai", "ollama", "anthropic"];
    const eligible = order
        .filter((providerId) => providerId !== state.providerId)
        .filter((providerId) => {
            if (providerId === "eclipse") return false;
            if (providerId === "openai") return state.openaiApiKey.length > 0;
            if (providerId === "ollama") return state.ollamaBaseUrl.length > 0;
            if (providerId === "anthropic") return state.anthropicApiKey.length > 0;
            return false;
        });

    const chain = [primary, ...eligible.map((providerId) => buildProviderFor(providerId, state))];
    return new FallbackProvider(chain);
}