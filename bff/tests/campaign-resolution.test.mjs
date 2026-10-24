import assert from "node:assert/strict";
import test from "node:test";
import { createDndBffServer } from "../src/server.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

function config() {
  return {
    publicOrigin: "https://dnd.example.test",
    secureCookie: true,
    cookieName: "__Host-eclipse_dnd_session",
    sessionTtlSeconds: 3600,
    chatTokenUrl: "https://chat.example.test/token",
    chatJwksUrl: "https://chat.example.test/jwks",
    chatIssuer: "https://chat.example.test",
    chatAudience: "eclipse-dnd-forge",
    clientId: "eclipse-dnd-forge",
    redirectUri: "https://dnd.example.test/",
    aiGatewayBaseUrl: "https://ai.example.test",
    aiGatewayServiceToken: "s".repeat(48),
    timeoutMs: 10_000,
    maxBodyBytes: 262_144,
    maxOutputTokens: 2_048,
    userRequestsPer15Minutes: 60,
    userDailyTokens: 250_000,
    productDailyTokens: 5_000_000,
    aiEnabled: false,
    budgetFile: undefined,
    campaignFile: undefined,
  };
}

function createFetch() {
  return async (url, init = {}) => {
    if (url === "https://chat.example.test/token") {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ access_token: body.code }), { status: 200 });
    }
    throw new Error(`Unexpected upstream: ${url}`);
  };
}

function createVerifier() {
  return {
    verify: async (token) => ({
      subject: token,
      displayName: "Ведущий",
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      jti: `11111111-1111-4111-8111-111111111111`,
    }),
  };
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/v1/auth/exchange`, {
    method: "POST",
    headers: { Origin: "https://dnd.example.test", "Content-Type": "application/json" },
    body: JSON.stringify({ code: "owner-code", codeVerifier: "v".repeat(64) }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const body = await response.json();
  return { cookie, csrfToken: body.csrfToken };
}

async function json(baseUrl, path, identity, init = {}, mutation = false) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Origin: "https://dnd.example.test",
      Cookie: identity.cookie,
      ...(mutation ? { "X-CSRF-Token": identity.csrfToken } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  return { response, body: await response.json() };
}

test("remote campaign accepts optional d20 resolution and persists a server result", async () => {
  const server = await createDndBffServer(config(), {
    fetchImpl: createFetch(),
    verifier: createVerifier(),
    logger: { info() {}, error() {} },
  });
  const baseUrl = await listen(server);
  try {
    const owner = await login(baseUrl);
    const created = await json(baseUrl, "/api/v1/campaigns", owner, {
      method: "POST", body: JSON.stringify({ title: "Проверка remote d20" }),
    }, true);
    assert.equal(created.response.status, 201);
    const campaignId = created.body.campaign.campaignId;

    const withResolution = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST",
      headers: { "Idempotency-Key": "action-resolution-1" },
      body: JSON.stringify({
        type: "action.append",
        expectedRevision: 0,
        payload: {
          id: "action-12345678-resolution",
          actor: "Иара",
          text: "Проверяю замок",
          diceExpression: "d20",
          resolution: { dc: 15, modifier: 2, mode: "advantage" },
        },
      }),
    }, true);
    assert.equal(withResolution.response.status, 201);
    const action = withResolution.body.event.payload.action;
    assert.equal(action.resolution.dc, 15);
    assert.equal(action.resolution.modifier, 2);
    assert.equal(action.resolution.mode, "advantage");
    assert.equal(action.resolution.rolls.length, 2);
    assert.equal(action.resolution.selected, Math.max(...action.resolution.rolls));
    assert.equal(action.resolution.natural, action.resolution.selected);
    assert.equal(action.resolution.total, action.resolution.selected + 2);
    assert.equal(action.dice.total, action.resolution.total);

    const persisted = await json(baseUrl, `/api/v1/campaigns/${campaignId}` , owner);
    assert.equal(persisted.response.status, 200);
    assert.deepEqual(persisted.body.campaign.actions[0].resolution, action.resolution);

    const legacy = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST",
      headers: { "Idempotency-Key": "action-legacy-1" },
      body: JSON.stringify({
        type: "action.append",
        expectedRevision: 1,
        payload: { id: "action-12345678-legacy", actor: "Иара", text: "Иду дальше", diceExpression: "d20+3" },
      }),
    }, true);
    assert.equal(legacy.response.status, 201);
    assert.equal("resolution" in legacy.body.event.payload.action, false);

    for (const [index, resolution] of [
      { dc: 0, modifier: 0, mode: "normal" },
      { dc: 10, modifier: 21, mode: "normal" },
      { dc: 10, modifier: 0, mode: "loaded" },
    ].entries()) {
      const invalid = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
        method: "POST",
        headers: { "Idempotency-Key": `action-invalid-${index}` },
        body: JSON.stringify({
          type: "action.append",
          expectedRevision: 2,
          payload: {
            id: `action-12345678-invalid-${index}`,
            actor: "Иара",
            text: "Проверка",
            diceExpression: "d20",
            resolution,
          },
        }),
      }, true);
      assert.equal(invalid.response.status, 400);
      assert.equal(invalid.body.error.code, "invalid_resolution");
    }
  } finally {
    await close(server);
  }
});
