const SESSION_STORAGE_KEY = "eclipse_dnd_pkce_v1";
const DEFAULT_BFF_URL = "https://api.dnd.eclipse-forge.ru";
const DEFAULT_CHAT_AUTHORIZE_URL = "https://app.star-crm.ru/eclipse-chat/";

export type DndSession = {
    authenticated: true;
    csrfToken: string;
    user: { displayName: string };
};

export class DndApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code: string,
    ) {
        super(message);
        this.name = "DndApiError";
    }
}

let cachedSession: DndSession | null = null;

function publicEndpoint(value: string | undefined, fallback: string): string {
    try {
        const url = new URL(value || fallback);
        const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.hash) {
            return fallback;
        }
        return url.toString().replace(/\/$/, "");
    } catch {
        return fallback;
    }
}

export const DND_BFF_URL = publicEndpoint(import.meta.env.VITE_DND_BFF_URL, DEFAULT_BFF_URL);
export const MANAGED_AI_ENABLED = import.meta.env.VITE_DND_MANAGED_AI_ENABLED === "true";
const CHAT_AUTHORIZE_URL = publicEndpoint(
    import.meta.env.VITE_ECLIPSE_CHAT_AUTHORIZE_URL,
    DEFAULT_CHAT_AUTHORIZE_URL,
);

function randomBase64Url(bytes: number): string {
    const values = new Uint8Array(bytes);
    crypto.getRandomValues(values);
    let binary = "";
    values.forEach((value) => { binary += String.fromCharCode(value); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(value: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    let binary = "";
    new Uint8Array(digest).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function callbackUri(): string {
    return new URL(window.location.pathname || "/", window.location.origin).toString();
}

function sameState(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}

async function parseResponse<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({})) as {
        error?: { code?: string; message?: string };
    };
    if (!response.ok) {
        throw new DndApiError(
            body.error?.message || `HTTP ${response.status}`,
            response.status,
            body.error?.code || "request_failed",
        );
    }
    return body as T;
}

export async function beginEclipseSignIn(): Promise<void> {
    if (!MANAGED_AI_ENABLED) {
        throw new DndApiError("Управляемый Eclipse AI ещё не включён оператором.", 503, "managed_ai_disabled");
    }
    const verifier = randomBase64Url(48);
    const state = randomBase64Url(32);
    const codeChallenge = await sha256Base64Url(verifier);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ verifier, state, createdAt: Date.now() }));

    const authorize = new URL(CHAT_AUTHORIZE_URL);
    authorize.searchParams.set("client_id", "eclipse-dnd-forge");
    authorize.searchParams.set("redirect_uri", callbackUri());
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("code_challenge", codeChallenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("state", state);
    authorize.hash = "authorize";
    window.location.assign(authorize.toString());
}

export function hasAuthorizationCallback(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has("code") || params.has("state");
}

export async function completeEclipseSignIn(): Promise<DndSession> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || "";
    const returnedState = params.get("state") || "";
    let stored: { verifier?: string; state?: string; createdAt?: number } = {};
    try {
        stored = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || "{}");
    } catch {
        stored = {};
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.history.replaceState(null, "", `${window.location.pathname}#/auth/callback`);
    if (
        !/^[A-Za-z0-9_-]{43}$/.test(code) ||
        typeof stored.verifier !== "string" ||
        typeof stored.state !== "string" ||
        typeof stored.createdAt !== "number" ||
        Date.now() - stored.createdAt > 10 * 60_000 ||
        !sameState(returnedState, stored.state)
    ) {
        throw new DndApiError("Ссылка входа устарела или была открыта не в этой вкладке.", 400, "invalid_callback");
    }
    const response = await fetch(`${DND_BFF_URL}/api/v1/auth/exchange`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, codeVerifier: stored.verifier }),
    });
    const session = await parseResponse<DndSession>(response);
    cachedSession = session;
    return session;
}

export async function getDndSession(force = false): Promise<DndSession | null> {
    if (!force && cachedSession) return cachedSession;
    const response = await fetch(`${DND_BFF_URL}/api/v1/auth/session`, {
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    const body = await parseResponse<DndSession | { authenticated: false }>(response);
    cachedSession = body.authenticated ? body : null;
    return cachedSession;
}

export async function signOutDnd(): Promise<void> {
    const session = await getDndSession();
    if (session) {
        await fetch(`${DND_BFF_URL}/api/v1/auth/logout`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken },
            body: "{}",
        });
    }
    cachedSession = null;
}

export async function dndApiJson<T>(path: string, init: RequestInit = {}, mutation = false): Promise<T> {
    const session = await getDndSession();
    if (!session) throw new DndApiError("Войдите через Eclipse Chat", 401, "authentication_required");
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (mutation) headers.set("X-CSRF-Token", session.csrfToken);
    const response = await fetch(`${DND_BFF_URL}${path}`, {
        ...init,
        headers,
        credentials: "include",
    });
    if (response.status === 401) cachedSession = null;
    return parseResponse<T>(response);
}
