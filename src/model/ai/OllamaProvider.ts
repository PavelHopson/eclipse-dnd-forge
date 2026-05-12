import { AiMessage, AiProvider, AiStreamOptions, AiStreamResult } from "./types";

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

        while (true) {
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
}
