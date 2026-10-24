import type { AiMessage, AiProvider, AiStreamOptions, AiStreamResult, StructuredOutputOptions, StructuredOutputSpec } from "./types";

/**
 * Chains multiple providers. Tries each in order; on error, moves to the next.
 *
 * If a provider already streamed some partial text before failing, we reset
 * the visible partial to "" on switch so the UI doesn't show the broken
 * fragment glued to the next provider's reply.
 *
 * If all providers fail, throws an aggregated error.
 */
export class FallbackProvider implements AiProvider {
    readonly id = "fallback" as const;
    readonly displayName = "Fallback chain";

    constructor(public providers: AiProvider[]) {
        if (providers.length === 0) {
            throw new Error("FallbackProvider: must wrap at least one provider");
        }
    }

    async streamChat(messages: AiMessage[], options: AiStreamOptions = {}): Promise<AiStreamResult> {
        const errors: string[] = [];

        for (let i = 0; i < this.providers.length; i++) {
            options.signal?.throwIfAborted();
            const provider = this.providers[i];

            if (i > 0) {
                // Wipe any partial text from the failed provider so the chat
                // bubble doesn't show a half-broken fragment.
                options.onPartial?.("");
            }

            try {
                return await provider.streamChat(messages, options);
            } catch (e: any) {
                options.signal?.throwIfAborted();
                if (["AbortError", "TimeoutError", "APIUserAbortError", "AiModuleLoadError"].includes(e?.name)) throw e;
                const msg = `${provider.id}: request failed`;
                errors.push(msg);
                // Keep going to the next provider.
            }
        }

        throw new Error(`Все AI-провайдеры недоступны. ${errors.join(" | ")}`);
    }

    async generateStructured<T>(
        messages: AiMessage[],
        spec: StructuredOutputSpec<T>,
        options: StructuredOutputOptions = {},
    ): Promise<T> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            options.signal?.throwIfAborted();
            try {
                return await provider.generateStructured(messages, spec, options);
            } catch (e: any) {
                options.signal?.throwIfAborted();
                if (["AbortError", "TimeoutError", "APIUserAbortError", "AiModuleLoadError"].includes(e?.name)) throw e;
                const msg = `${provider.id}: request failed`;
                errors.push(msg);
            }
        }
        throw new Error(`Все AI-провайдеры недоступны (структурированный вывод). ${errors.join(" | ")}`);
    }
}
