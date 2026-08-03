import { AiMessage, AiProvider, AiStreamOptions, AiStreamResult, StructuredOutputOptions, StructuredOutputSpec } from "./types";
import { zodToJsonSchema } from "./zodToJsonSchema";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2";

/**
 * Self-hosted Ollama provider. Talks to a local Ollama daemon over HTTP.
 *
 * Setup notes for the user:
 *  - Run Ollama locally (https://ollama.com)
 *  - Pull a chat-capable model: `ollama pull llama3.2`
 *  - Make sure CORS lets the browser talk to it. Ollama only allows the
 *    request origin if you launch it with `OLLAMA_ORIGINS="*"` (or a more
 *    specific allow-list). On Windows, set the env var before starting
 *    Ollama; on macOS/Linux: `OLLAMA_ORIGINS="*" ollama serve`.
 *  - Default base URL is http://localhost:11434.
 *
 * The streaming endpoint is `POST /api/chat` with `stream: true`. The body
 * is newline-delimited JSON, each line shaped like:
 *   { "model": "...", "message": { "role": "assistant", "content": "..." },
 *     "done": false }
 * The final line has `"done": true`.
 */
export class OllamaProvider implements AiProvider {
    readonly id = "ollama" as const;
    readonly displayName = "Ollama (self-hosted)";

    constructor(
        public baseUrl: string = DEFAULT_BASE_URL,
        public defaultModel: string = DEFAULT_MODEL,
    ) {}

    async streamChat(messages: AiMessage[], options: AiStreamOptions = {}): Promise<AiStreamResult> {
        const url = `${this.baseUrl.replace(/\/+$/, "")}/api/chat`;
        const body = {
            model: options.model || this.defaultModel,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
            options: {
                temperature: options.temperature ?? 0.8,
            },
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: options.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(`Ollama HTTP ${response.status}: ${errText || response.statusText}`);
        }
        if (!response.body) {
            throw new Error("Ollama: response body is empty (streaming not supported by this environment?)");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let text = "";

        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Ollama emits NDJSON — one JSON object per line.
            let nl: number;
            while ((nl = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (!line) continue;

                let parsed: any;
                try {
                    parsed = JSON.parse(line);
                } catch {
                    // Partial line slipped through — skip; the next read will reconstruct.
                    continue;
                }

                const delta: string = parsed?.message?.content ?? "";
                if (delta) {
                    text += delta;
                    options.onPartial?.(text);
                }

                if (parsed?.error) {
                    throw new Error(`Ollama error: ${parsed.error}`);
                }
            }
        }

        return { text };
    }

    /**
     * Ollama structured output via `format: "json"` plus a system-prompt
     * description of the expected schema. Ollama's JSON mode guarantees
     * parseable JSON but not schema compliance — we validate with zod and
     * throw on mismatch so the caller (or FallbackProvider) can retry.
     */
    async generateStructured<T>(
        messages: AiMessage[],
        spec: StructuredOutputSpec<T>,
        options: StructuredOutputOptions = {},
    ): Promise<T> {
        const url = `${this.baseUrl.replace(/\/+$/, "")}/api/chat`;
        const jsonSchema = zodToJsonSchema(spec.schema as any);

        // Augment the last system message (or prepend one) with the schema.
        const schemaInstruction = `Reply with a SINGLE JSON object that conforms to this JSON Schema. No prose, no markdown fences:\n${JSON.stringify(jsonSchema)}`;
        const augmented: AiMessage[] = [...messages];
        const lastSystemIdx = [...augmented].reverse().findIndex((m) => m.role === "system");
        if (lastSystemIdx >= 0) {
            const idx = augmented.length - 1 - lastSystemIdx;
            augmented[idx] = { ...augmented[idx], content: `${augmented[idx].content}\n\n${schemaInstruction}` };
        } else {
            augmented.unshift({ role: "system", content: schemaInstruction });
        }

        const body = {
            model: options.model || this.defaultModel,
            messages: augmented.map((m) => ({ role: m.role, content: m.content })),
            stream: false,
            format: "json",
            options: { temperature: options.temperature ?? 0 },
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: options.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(`Ollama HTTP ${response.status}: ${errText || response.statusText}`);
        }
        const data: any = await response.json();
        const content: string = data?.message?.content ?? "";
        if (!content) {
            throw new Error("Ollama structured output: empty content");
        }

        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (e: any) {
            throw new Error(`Ollama structured output: invalid JSON (${e?.message ?? e}). Raw: ${content.slice(0, 200)}`);
        }

        return spec.schema.parse(parsed);
    }
}
