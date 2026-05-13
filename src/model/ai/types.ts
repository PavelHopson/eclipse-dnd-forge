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

/** User-facing provider choices. The fallback wrapper has its own internal id. */
export type AiProviderId = "openai" | "ollama" | "anthropic";

/**
 * Spec for a structured-output call. Caller passes a zod schema; the provider
 * is responsible for getting the model to emit JSON that satisfies it, by
 * whatever native mechanism the API supports (OpenAI response_format,
 * Anthropic tool-use, Ollama format=json + prompt-engineering).
 */
export interface StructuredOutputSpec<T> {
    /** Zod schema for the expected payload. Used both to coerce the provider
     *  request and to validate the final reply. */
    schema: import("zod").ZodType<T>;
    /** Short identifier for the output shape — surfaces in Anthropic tool name. */
    schemaName: string;
}

export interface StructuredOutputOptions {
    model?: string;
    temperature?: number;
    signal?: AbortSignal;
}

export interface AiProvider {
    /** Stable identifier — one of `AiProviderId` for real providers, or `"fallback"` for the chain wrapper. */
    readonly id: AiProviderId | "fallback";
    readonly displayName: string;
    /** Stream a chat completion. Each delta is also forwarded through `options.onPartial`. */
    streamChat(messages: AiMessage[], options?: AiStreamOptions): Promise<AiStreamResult>;
    /** Return JSON conforming to `spec.schema`. Each provider implements this
     *  with its native structured-output mechanism. Throws on validation
     *  failure so the caller can decide whether to retry or fall back. */
    generateStructured<T>(
        messages: AiMessage[],
        spec: StructuredOutputSpec<T>,
        options?: StructuredOutputOptions,
    ): Promise<T>;
}
