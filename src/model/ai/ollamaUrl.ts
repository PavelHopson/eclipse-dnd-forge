const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

function isLoopback(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/**
 * Ollama is a browser-direct local provider. Keep prompts on the local
 * daemon by default; credentials, query strings and arbitrary paths are not
 * accepted as a base URL.
 */
export function normalizeOllamaBaseUrl(raw: string): string {
    const value = raw.trim() || DEFAULT_OLLAMA_BASE_URL;
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error("Ollama URL must be a valid local origin");
    }
    if (!/^https?:$/.test(parsed.protocol) || !isLoopback(parsed.hostname)
        || parsed.username || parsed.password || parsed.search || parsed.hash
        || (parsed.pathname !== "/" && parsed.pathname !== "")) {
        throw new Error("Ollama URL must use a loopback origin without credentials, query, hash or path");
    }
    return parsed.origin;
}

export function isAllowedOllamaBaseUrl(raw: string): boolean {
    try {
        normalizeOllamaBaseUrl(raw);
        return true;
    } catch {
        return false;
    }
}

export const DEFAULT_OLLAMA_URL = DEFAULT_OLLAMA_BASE_URL;
