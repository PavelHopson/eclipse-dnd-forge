export interface CloudCredentials {
    openaiApiKey: string;
    anthropicApiKey: string;
}

interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export const SESSION_CREDENTIALS_KEY = "eclipse_dnd_ai_credentials_session_v1";
export const LEGACY_CONFIG_KEY = "eclipse_dnd_ai_config_v2";

const EMPTY_CREDENTIALS: CloudCredentials = {
    openaiApiKey: "",
    anthropicApiKey: "",
};

function browserStorage(name: "localStorage" | "sessionStorage"): StorageLike | null {
    if (typeof window === "undefined") return null;
    try {
        return window[name];
    } catch {
        return null;
    }
}

function readCredentials(storage: StorageLike | null): CloudCredentials {
    if (!storage) return { ...EMPTY_CREDENTIALS };
    try {
        const parsed = JSON.parse(storage.getItem(SESSION_CREDENTIALS_KEY) || "{}");
        return {
            openaiApiKey: typeof parsed.openaiApiKey === "string" ? parsed.openaiApiKey : "",
            anthropicApiKey: typeof parsed.anthropicApiKey === "string" ? parsed.anthropicApiKey : "",
        };
    } catch {
        return { ...EMPTY_CREDENTIALS };
    }
}

function migrateLegacyAnthropicKey(
    persistentStorage: StorageLike | null,
    sessionStorage: StorageLike | null,
    current: CloudCredentials,
): CloudCredentials {
    if (!persistentStorage) return current;

    try {
        const raw = persistentStorage.getItem(LEGACY_CONFIG_KEY);
        if (!raw) return current;
        const legacyConfig = JSON.parse(raw);
        if (!legacyConfig || typeof legacyConfig !== "object" || !("anthropicApiKey" in legacyConfig)) {
            return current;
        }

        const legacyKey = typeof legacyConfig.anthropicApiKey === "string"
            ? legacyConfig.anthropicApiKey
            : "";
        delete legacyConfig.anthropicApiKey;

        // Remove the old record first so a failed rewrite cannot leave a
        // plaintext cloud credential in persistent browser storage.
        persistentStorage.removeItem(LEGACY_CONFIG_KEY);
        try {
            persistentStorage.setItem(LEGACY_CONFIG_KEY, JSON.stringify(legacyConfig));
        } catch {
            // Losing non-secret UI preferences is safer than restoring a key.
        }

        if (!current.anthropicApiKey && legacyKey) {
            const migrated = { ...current, anthropicApiKey: legacyKey };
            persistSessionCredentials(migrated, sessionStorage);
            return migrated;
        }
    } catch {
        // Malformed or unavailable legacy storage must not block the app.
    }

    return current;
}

export function loadSessionCredentials(
    sessionStorage = browserStorage("sessionStorage"),
    persistentStorage = browserStorage("localStorage"),
): CloudCredentials {
    return migrateLegacyAnthropicKey(
        persistentStorage,
        sessionStorage,
        readCredentials(sessionStorage),
    );
}

export function persistSessionCredentials(
    credentials: CloudCredentials,
    storage = browserStorage("sessionStorage"),
): void {
    if (!storage) return;
    try {
        storage.setItem(SESSION_CREDENTIALS_KEY, JSON.stringify(credentials));
    } catch {
        // Private browsing and locked-down contexts may deny sessionStorage.
    }
}

export function clearSessionCredentials(storage = browserStorage("sessionStorage")): void {
    try {
        storage?.removeItem(SESSION_CREDENTIALS_KEY);
    } catch {
        // The in-memory Zustand state is still cleared by the caller.
    }
}

export function sanitizeLegacyCredentialHash(hash: string): string {
    const queryIndex = hash.indexOf("?");
    if (queryIndex < 0) return hash;

    const route = hash.slice(0, queryIndex);
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    if (!params.has("k")) return hash;

    params.delete("k");
    const remaining = params.toString();
    return remaining ? `${route}?${remaining}` : route;
}

export function safeHashAfterCredentialRemoval(hash: string): string {
    const cleanHash = sanitizeLegacyCredentialHash(hash);
    if (cleanHash === hash) return hash;

    // A legacy shared/bookmarked URL no longer has a usable credential after
    // cleanup. Return to the launcher instead of opening a broken campaign
    // workspace that would fail only after the first AI action.
    return cleanHash.startsWith("#/free-form") ? "#/" : cleanHash;
}

export function stripLegacyCredentialFromAddress(): void {
    if (typeof window === "undefined") return;
    const cleanHash = safeHashAfterCredentialRemoval(window.location.hash);
    if (cleanHash === window.location.hash) return;
    window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${cleanHash}`,
    );
}
