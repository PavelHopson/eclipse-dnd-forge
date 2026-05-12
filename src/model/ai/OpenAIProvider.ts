import { openai } from "../Model";
import { AiMessage, AiProvider, AiStreamOptions, AiStreamResult } from "./types";

const DEFAULT_MODEL = "gpt-4o-2024-08-06";

export class OpenAIProvider implements AiProvider {
    readonly id = "openai" as const;
    readonly displayName = "OpenAI (cloud)";

    async streamChat(messages: AiMessage[], options: AiStreamOptions = {}): Promise<AiStreamResult> {
        const stream = await openai.chat.completions.create({
            model: options.model || DEFAULT_MODEL,
            messages,
            stream: true,
            temperature: options.temperature ?? 0.8,
        }, options.signal ? { signal: options.signal } : undefined);

        let text = "";
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
                text += delta;
                options.onPartial?.(text);
            }
        }

        return { text };
    }
}
