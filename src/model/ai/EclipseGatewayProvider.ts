import { dndApiJson } from "../auth/dndSession";
import { zodToJsonSchema } from "./zodToJsonSchema";
import type {
    AiMessage,
    AiProvider,
    AiStreamOptions,
    AiStreamResult,
    StructuredOutputOptions,
    StructuredOutputSpec,
} from "./types";

const DEFAULT_MODEL = "auto/best-chat";

type Completion = {
    choices?: Array<{ message?: { content?: string } }>;
};

function contentFrom(completion: Completion): string {
    const content = completion.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content) {
        throw new Error("Eclipse AI вернул пустой ответ");
    }
    return content;
}

function jsonText(content: string): string {
    const trimmed = content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced?.[1] || trimmed;
}

export class EclipseGatewayProvider implements AiProvider {
    readonly id = "eclipse" as const;
    readonly displayName = "Eclipse AI";

    constructor(public defaultModel = DEFAULT_MODEL) {}

    async streamChat(messages: AiMessage[], options: AiStreamOptions = {}): Promise<AiStreamResult> {
        const completion = await dndApiJson<Completion>("/api/v1/ai/chat/completions", {
            method: "POST",
            body: JSON.stringify({
                model: options.model || this.defaultModel,
                messages,
                temperature: options.temperature ?? 0.8,
                max_tokens: 1024,
                stream: false,
            }),
            signal: options.signal,
        }, true);
        const text = contentFrom(completion);
        options.onPartial?.(text);
        return { text };
    }

    async generateStructured<T>(
        messages: AiMessage[],
        spec: StructuredOutputSpec<T>,
        options: StructuredOutputOptions = {},
    ): Promise<T> {
        const schema = zodToJsonSchema(spec.schema as never);
        const instruction = `Return one JSON object matching this JSON Schema. Do not add prose or markdown fences:\n${JSON.stringify(schema)}`;
        const completion = await dndApiJson<Completion>("/api/v1/ai/chat/completions", {
            method: "POST",
            body: JSON.stringify({
                model: options.model || this.defaultModel,
                messages: [{ role: "system", content: instruction }, ...messages],
                temperature: options.temperature ?? 0,
                max_tokens: 2048,
                stream: false,
            }),
            signal: options.signal,
        }, true);
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonText(contentFrom(completion)));
        } catch {
            throw new Error("Eclipse AI не смог вернуть корректные структурированные данные");
        }
        return spec.schema.parse(parsed);
    }
}
