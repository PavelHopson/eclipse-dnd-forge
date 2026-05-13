import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "../Model";
import { AiMessage, AiProvider, AiStreamOptions, AiStreamResult, StructuredOutputOptions, StructuredOutputSpec } from "./types";

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

    async generateStructured<T>(
        messages: AiMessage[],
        spec: StructuredOutputSpec<T>,
        options: StructuredOutputOptions = {},
    ): Promise<T> {
        const response = await openai.chat.completions.create({
            model: options.model || DEFAULT_MODEL,
            messages,
            temperature: options.temperature ?? 0,
            response_format: zodResponseFormat(spec.schema as any, spec.schemaName),
        }, options.signal ? { signal: options.signal } : undefined);

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("OpenAI structured output: empty content");
        }
        // OpenAI guarantees the content matches the schema once response_format
        // is set, but we still pipe through zod.parse for defensive validation.
        const parsed = JSON.parse(content);
        return spec.schema.parse(parsed);
    }
}
