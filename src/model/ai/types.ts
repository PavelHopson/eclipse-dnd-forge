/**
 * Provider-neutral types for the conversational AI path (NPC dialogue, DM
 * narration). Structured-output paths (JSONPrompt, entity extractors, NPC
 * generator) stay OpenAI-only — they rely on `response_format` with a zod
 * schema, which is an OpenAI-specific feature.
 */

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
    role: AiRole;
    content: string;
}

export interface AiStreamOptions {
    /** Provider-specific model identifier. Each provider has its own default. */
    model?: string;
    /** 0 = deterministic, 1+ = creative. Defaults vary by provider. */
    temperature?: number;
    /** Fired for every streamed delta — receives the *cumulative* response so far. */
    onPartial?: (partial: string) => void;
    /** Aborts the in-flight request when triggered. */
    signal?: AbortSignal;
}

export interface AiStreamResult {
    /** Full final response after the stream closes. */
    text: string;
}

export type AiProviderId = "openai" | "ollama";

export interface AiProvider {
    readonly id: AiProviderId;
    readonly displayName: string;
    /** Stream a chat completion. Each delta is also forwarded through `options.onPartial`. */
    streamChat(messages: AiMessage[], options?: AiStreamOptions): Promise<AiStreamResult>;
}
