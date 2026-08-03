import assert from "node:assert/strict";
import test from "node:test";
import {
    clearSessionCredentials,
    LEGACY_CONFIG_KEY,
    loadSessionCredentials,
    persistSessionCredentials,
    safeHashAfterCredentialRemoval,
    sanitizeLegacyCredentialHash,
    SESSION_CREDENTIALS_KEY,
} from "../src/model/ai/credentialStorage.ts";

class MemoryStorage {
    values = new Map();

    getItem(key) {
        return this.values.get(key) ?? null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

test("moves the legacy Anthropic key out of persistent storage", () => {
    const persistent = new MemoryStorage();
    const session = new MemoryStorage();
    persistent.setItem(LEGACY_CONFIG_KEY, JSON.stringify({
        providerId: "anthropic",
        anthropicApiKey: "sk-ant-legacy",
        anthropicModel: "claude-test",
    }));

    const credentials = loadSessionCredentials(session, persistent);

    assert.equal(credentials.anthropicApiKey, "sk-ant-legacy");
    assert.equal(JSON.parse(session.getItem(SESSION_CREDENTIALS_KEY)).anthropicApiKey, "sk-ant-legacy");
    const sanitized = JSON.parse(persistent.getItem(LEGACY_CONFIG_KEY));
    assert.equal("anthropicApiKey" in sanitized, false);
    assert.equal(sanitized.anthropicModel, "claude-test");
});

test("keeps cloud credentials session-only and supports explicit clearing", () => {
    const session = new MemoryStorage();
    persistSessionCredentials({
        openaiApiKey: "sk-session",
        anthropicApiKey: "sk-ant-session",
    }, session);

    assert.deepEqual(loadSessionCredentials(session, null), {
        openaiApiKey: "sk-session",
        anthropicApiKey: "sk-ant-session",
    });

    clearSessionCredentials(session);
    assert.equal(session.getItem(SESSION_CREDENTIALS_KEY), null);
});

test("removes the legacy key parameter without damaging unrelated hash state", () => {
    assert.equal(sanitizeLegacyCredentialHash("#/free-form?k=c2VjcmV0"), "#/free-form");
    assert.equal(sanitizeLegacyCredentialHash("#/free-form?view=world&k=secret"), "#/free-form?view=world");
    assert.equal(sanitizeLegacyCredentialHash("#/free-form?view=world"), "#/free-form?view=world");
    assert.equal(safeHashAfterCredentialRemoval("#/free-form?view=world&k=secret"), "#/");
    assert.equal(safeHashAfterCredentialRemoval("#/free-form?view=world"), "#/free-form?view=world");
});
