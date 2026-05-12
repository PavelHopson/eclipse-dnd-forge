import { AiMessage, AiProvider, AiStreamOptions, AiStreamResult } from "./types";

const DEFAULT_MODEL = "claude-opus-4-7";
const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Anthropic Claude provider.
 *
 * Browser-direct calls require the `anthropic-dangerous-direct-browser-access`
 * header (Anthropic's CORS-allow opt-in, same shape as OpenAI's
 * `dangerouslyAllowBrowser: true`). For production we should route through a
 * backend; this provider is local-prototype only, same posture as the
 * existing OpenAI client.
 *
 * Streaming uses Server-Sent Events. Each event has shape:
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
 *
 * We only consume the text_delta deltas; other event types (message_start,
 * ping, message_delta, message_stop) are ignored.
 */
export class AnthropicProvider implements AiProvider {
    readonly id = "anthropic" as const;
    readonly displayName = "Anthropic Claude (cloud)";

    constructor(
        public apiKey: string,
        public defaultModel: string = DEFAULT_MODEL,
    ) {}

    async streamChat(messages: AiMessage[], options: AiStreamOptions = {}): Promise<AiStreamResult> {
        if (!this.apiKey) {
            throw new Error("Anthropic: API key is empty. Paste it on the Launcher.");
        }

        // Anthropic expects system prompt out-of-band, not as a message role.
        const systemContent = messages
            .filter((m) => m.role === "system")
            .map((m) => m.content)
            .join("\n\n");
        const conversation = messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "x-api-key": this.apiKey,
                "anthropic-version": ANTHROPIC_VERSION,
                "anthropic-dangerous-direct-browser-access": "true",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: options.model || this.defaultModel,
                max_tokens: 4096,
                system: systemContent || undefined,
                messages: conversation,
                stream: true,
                temperature: options.temperature ?? 0.8,
            }),
            signal: options.signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(`Anthropic HTTP ${response.status}: ${errText || response.statusText}`);
        }
        if (!response.body) {
            throw new Error("Anthropic: empty response body (streaming not supported here?)");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let text = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE is line-oriented; deltas come as `data: { ... }` lines.
            let nl: number;
            while ((nl = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, nl);
                buffer = buffer.slice(nl + 1);

                if (!line.startsWith("data: ")) continue;
                const payload = line.slice(6).trim();
                if (!payload || payload === "[DONE]") continue;

                let event: any;
                try {
                    event = JSON.parse(payload);
                } catch {
                    continue;
                }

                if (event?.type === "content_block_delta" && event.delta?.type === "text_delta") {
                    const delta: string = event.delta.text ?? "";
                    if (delta) {
                        text += delta;
                        options.onPartial?.(text);
                    }
                } else if (event?.type === "error") {
                    const msg = event.error?.message || "unknown error";
                    throw new Error(`Anthropic stream error: ${msg}`);
                }
            }
        }

        return { text };
    }
}
