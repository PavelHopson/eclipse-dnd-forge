import assert from "node:assert/strict";
import test from "node:test";
import { loadBffConfig } from "../src/config.mjs";

function productionEnv(overrides = {}) {
    return {
        NODE_ENV: "production",
        DND_BFF_SECURE_COOKIE: "true",
        DND_CHAT_TOKEN_URL: "https://chat.example.test/token",
        DND_CHAT_JWKS_URL: "https://chat.example.test/jwks",
        DND_CHAT_ISSUER: "https://chat.example.test",
        DND_CHAT_REDIRECT_URI: "https://dnd.example.test/",
        DND_AI_GATEWAY_BASE_URL: "https://ai.example.test",
        DND_AI_GATEWAY_SERVICE_TOKEN: "s".repeat(48),
        DND_BFF_BUDGET_FILE: "C:\\var\\budgets.json",
        DND_BFF_CAMPAIGN_FILE: "C:\\var\\campaigns.json",
        ...overrides,
    };
}

test("production requires a separate campaign persistence path", () => {
    assert.throws(
        () => loadBffConfig(productionEnv({ DND_BFF_CAMPAIGN_FILE: "" })),
        /DND_BFF_CAMPAIGN_FILE is required in production/,
    );
});

test("campaign persistence path rejects shell metacharacters", () => {
    assert.throws(
        () => loadBffConfig(productionEnv({ DND_BFF_CAMPAIGN_FILE: "C:\\var\\campaigns;rm.json" })),
        /DND_BFF_CAMPAIGN_FILE must be an absolute path without shell metacharacters/,
    );
});
