import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDndBffServer } from "../src/server.mjs";
import { createCampaignStore } from "../src/campaignStore.mjs";

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

function config(campaignFile = undefined) {
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
    campaignFile,
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
      displayName: token === "owner-code" ? "Ведущий" : "Игрок",
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      jti: `11111111-1111-4111-8111-${token === "owner-code" ? "111111111111" : "222222222222"}`,
    }),
  };
}

async function login(baseUrl, code) {
  const response = await fetch(`${baseUrl}/api/v1/auth/exchange`, {
    method: "POST",
    headers: { Origin: "https://dnd.example.test", "Content-Type": "application/json" },
    body: JSON.stringify({ code, codeVerifier: "v".repeat(64) }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const body = await response.json();
  return { cookie, csrfToken: body.csrfToken };
}

function headers(identity, mutation = false) {
  return {
    Origin: "https://dnd.example.test",
    Cookie: identity.cookie,
    ...(mutation ? { "X-CSRF-Token": identity.csrfToken } : {}),
  };
}

async function json(baseUrl, path, identity, init = {}, mutation = false) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(identity, mutation),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  return { response, body: await response.json() };
}

test("server-owned campaigns enforce membership ACL and player-safe projection", async () => {
  const server = await createDndBffServer(config(), {
    fetchImpl: createFetch(),
    verifier: createVerifier(),
    logger: { info() {}, error() {} },
  });
  const baseUrl = await listen(server);
  try {
    const owner = await login(baseUrl, "owner-code");
    const player = await login(baseUrl, "player-code");
    const created = await json(baseUrl, "/api/v1/campaigns", owner, {
      method: "POST", body: JSON.stringify({ title: "Лунный перевал" }),
    }, true);
    assert.equal(created.response.status, 201);
    const campaignId = created.body.campaign.campaignId;
    const invite = await json(baseUrl, `/api/v1/campaigns/${campaignId}/invites`, owner, {
      method: "POST", body: JSON.stringify({ role: "player" }),
    }, true);
    assert.equal(invite.response.status, 201);
    const joined = await json(baseUrl, "/api/v1/campaigns/join", player, {
      method: "POST", body: JSON.stringify({ inviteToken: invite.body.inviteToken }),
    }, true);
    assert.equal(joined.response.status, 200);
    assert.equal(joined.body.campaign.role, "player");

    const privateNote = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST",
      headers: { "Idempotency-Key": "note-owner-1" },
      body: JSON.stringify({ type: "gm.note", payload: { text: "Секрет мастера" }, expectedRevision: 0 }),
    }, true);
    assert.equal(privateNote.response.status, 201);
    const playerAction = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, player, {
      method: "POST",
      headers: { "Idempotency-Key": "action-player-1" },
      body: JSON.stringify({
        type: "action.append",
        payload: { id: "action-12345678-player", actor: "Иара", text: "Осматриваю арку", diceExpression: "d20" },
        expectedRevision: 1,
      }),
    }, true);
    assert.equal(playerAction.response.status, 201);
    const playerResolutionForbidden = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, player, {
      method: "POST",
      headers: { "Idempotency-Key": "action-player-resolution-1" },
      body: JSON.stringify({
        type: "action.append",
        payload: { id: "action-12345678-player-resolution", actor: "Иара", text: "Подменяю DC", diceExpression: "d20", resolution: { dc: 1, modifier: 20, mode: "normal" } },
        expectedRevision: 2,
      }),
    }, true);
    assert.equal(playerResolutionForbidden.response.status, 403);
    const playerResolveForbidden = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, player, {
      method: "POST",
      headers: { "Idempotency-Key": "resolve-player-1" },
      body: JSON.stringify({ type: "action.resolve", payload: { actionId: "action-12345678-player", text: "Ответ игроку" }, expectedRevision: 2 }),
    }, true);
    assert.equal(playerResolveForbidden.response.status, 403);
    const playerCheckForbidden = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, player, {
      method: "POST",
      headers: { "Idempotency-Key": "check-player-1" },
      body: JSON.stringify({ type: "action.check", payload: { actionId: "action-12345678-player", dc: 12, modifier: 2, mode: "normal" }, expectedRevision: 2 }),
    }, true);
    assert.equal(playerCheckForbidden.response.status, 403);
    const ownerCheck = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST",
      headers: { "Idempotency-Key": "check-owner-1" },
      body: JSON.stringify({ type: "action.check", payload: { actionId: "action-12345678-player", dc: 12, modifier: 2, mode: "advantage" }, expectedRevision: 2 }),
    }, true);
    assert.equal(ownerCheck.response.status, 201);
    assert.equal(ownerCheck.body.event.payload.actionId, "action-12345678-player");
    assert.equal(ownerCheck.body.event.payload.resolution.rolls.length, 2);
    const ownerResolve = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST",
      headers: { "Idempotency-Key": "resolve-owner-1" },
      body: JSON.stringify({ type: "action.resolve", payload: { actionId: "action-12345678-player", text: "За аркой открывается проход." }, expectedRevision: 3 }),
    }, true);
    assert.equal(ownerResolve.response.status, 201);
    const replayResolve = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST",
      headers: { "Idempotency-Key": "resolve-owner-1" },
      body: JSON.stringify({ type: "action.resolve", payload: { actionId: "action-12345678-player", text: "За аркой открывается проход." }, expectedRevision: 3 }),
    }, true);
    assert.equal(replayResolve.response.status, 200);
    assert.equal(replayResolve.body.event.eventId, ownerResolve.body.event.eventId);
    const staleResolve = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST",
      headers: { "Idempotency-Key": "resolve-owner-2" },
      body: JSON.stringify({ type: "action.resolve", payload: { actionId: "action-12345678-player", text: "Другой ответ" }, expectedRevision: 3 }),
    }, true);
    assert.equal(staleResolve.response.status, 409);
    const playerView = await json(baseUrl, `/api/v1/campaigns/${campaignId}`, player);
    assert.equal(playerView.response.status, 200);
    assert.equal(playerView.body.campaign.role, "player");
    assert.equal("privateNotes" in playerView.body.campaign, false);
    assert.equal("members" in playerView.body.campaign, false);
    assert.equal(JSON.stringify(playerView.body).includes("Секрет мастера"), false);
    assert.equal(playerView.body.campaign.actions[0].dmReply.text, "За аркой открывается проход.");

    const forbidden = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, player, {
      method: "POST",
      headers: { "Idempotency-Key": "scene-player-1" },
      body: JSON.stringify({ type: "scene.update", payload: { title: "Чужая сцена", description: "Нет" }, expectedRevision: 4 }),
    }, true);
    assert.equal(forbidden.response.status, 403);
  } finally {
    await close(server);
  }
});

test("campaign events are revisioned, idempotent, reconnectable and backed up", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eclipse-campaign-"));
  const campaignFile = join(directory, "campaigns.json");
  const server = await createDndBffServer(config(campaignFile), {
    fetchImpl: createFetch(),
    verifier: createVerifier(),
    logger: { info() {}, error() {} },
  });
  const baseUrl = await listen(server);
  try {
    const owner = await login(baseUrl, "owner-code");
    const created = await json(baseUrl, "/api/v1/campaigns", owner, {
      method: "POST", body: JSON.stringify({ title: "Маяк на краю тумана" }),
    }, true);
    const campaignId = created.body.campaign.campaignId;
    const eventBody = { type: "scene.update", payload: { title: "Каменный порог", description: "Свет в арке." }, expectedRevision: 0 };
    const first = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "scene-owner-1" }, body: JSON.stringify(eventBody),
    }, true);
    assert.equal(first.response.status, 201);
    const replay = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "scene-owner-1" }, body: JSON.stringify(eventBody),
    }, true);
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.event.eventId, first.body.event.eventId);

    const modifiedKey = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "scene-owner-1" },
      body: JSON.stringify({ ...eventBody, payload: { title: "Подмена", description: "Нет" } }),
    }, true);
    assert.equal(modifiedKey.response.status, 409);
    const stale = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "scene-owner-2" }, body: JSON.stringify(eventBody),
    }, true);
    assert.equal(stale.response.status, 409);

    const delta = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events?afterRevision=0`, owner);
    assert.equal(delta.response.status, 200);
    assert.equal(delta.body.events.length, 1);
    assert.equal(delta.body.revision, 1);

    const backup = await json(baseUrl, `/api/v1/campaigns/${campaignId}/backup`, owner);
    assert.equal(backup.response.status, 200);
    const restored = await json(baseUrl, "/api/v1/campaigns/restore", owner, {
      method: "POST", body: JSON.stringify({ backup: backup.body.backup }),
    }, true);
    assert.equal(restored.response.status, 201);
    assert.notEqual(restored.body.campaign.campaignId, campaignId);
    assert.equal(restored.body.campaign.scene.title, "Каменный порог");
    assert.equal((await readFile(campaignFile, "utf8")).includes("Каменный порог"), true);
  } finally {
    await close(server);
  }
});

test("campaign initiative turn is server-owned, revisioned and player-safe", async () => {
  const server = await createDndBffServer(config(), {
    fetchImpl: createFetch(),
    verifier: createVerifier(),
    logger: { info() {}, error() {} },
  });
  const baseUrl = await listen(server);
  try {
    const owner = await login(baseUrl, "owner-code");
    const player = await login(baseUrl, "player-code");
    const created = await json(baseUrl, "/api/v1/campaigns", owner, {
      method: "POST", body: JSON.stringify({ title: "Ход у врат" }),
    }, true);
    const campaignId = created.body.campaign.campaignId;
    const invite = await json(baseUrl, `/api/v1/campaigns/${campaignId}/invites`, owner, {
      method: "POST", body: JSON.stringify({ role: "player" }),
    }, true);
    await json(baseUrl, "/api/v1/campaigns/join", player, {
      method: "POST", body: JSON.stringify({ inviteToken: invite.body.inviteToken }),
    }, true);
    const entries = [
      { id: "initiative-12345678-aria", name: "Иара", value: 18, active: false },
      { id: "initiative-12345678-guard", name: "Страж", value: 12, active: false },
    ];
    const saved = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "initiative-set-1" },
      body: JSON.stringify({ type: "initiative.set", payload: { entries }, expectedRevision: 0 }),
    }, true);
    assert.equal(saved.response.status, 201);
    assert.equal(saved.body.campaign.turn.active, false);
    const started = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "initiative-start-1" },
      body: JSON.stringify({ type: "initiative.start", payload: {}, expectedRevision: 1 }),
    }, true);
    assert.equal(started.response.status, 201);
    assert.equal(started.body.campaign.turn.round, 1);
    assert.equal(started.body.campaign.turn.activeEntryId, "initiative-12345678-aria");
    const advanced = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "initiative-advance-1" },
      body: JSON.stringify({ type: "initiative.advance", payload: {}, expectedRevision: 2 }),
    }, true);
    assert.equal(advanced.response.status, 201);
    assert.equal(advanced.body.campaign.turn.activeEntryId, "initiative-12345678-guard");
    const wrapped = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "initiative-advance-2" },
      body: JSON.stringify({ type: "initiative.advance", payload: {}, expectedRevision: 3 }),
    }, true);
    assert.equal(wrapped.response.status, 201);
    assert.equal(wrapped.body.campaign.turn.round, 2);
    assert.equal(wrapped.body.campaign.turn.activeEntryId, "initiative-12345678-aria");
    const replay = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "initiative-advance-2" },
      body: JSON.stringify({ type: "initiative.advance", payload: {}, expectedRevision: 3 }),
    }, true);
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.event.eventId, wrapped.body.event.eventId);
    const playerView = await json(baseUrl, `/api/v1/campaigns/${campaignId}`, player);
    assert.equal(playerView.response.status, 200);
    assert.equal(playerView.body.campaign.turn.round, 2);
    assert.equal(playerView.body.campaign.initiative.find((entry) => entry.id === "initiative-12345678-aria").active, true);
    const forbidden = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, player, {
      method: "POST", headers: { "Idempotency-Key": "initiative-player-1" },
      body: JSON.stringify({ type: "initiative.advance", payload: {}, expectedRevision: 4 }),
    }, true);
    assert.equal(forbidden.response.status, 403);
    const ended = await json(baseUrl, `/api/v1/campaigns/${campaignId}/events`, owner, {
      method: "POST", headers: { "Idempotency-Key": "initiative-end-1" },
      body: JSON.stringify({ type: "initiative.end", payload: {}, expectedRevision: 4 }),
    }, true);
    assert.equal(ended.response.status, 201);
    assert.equal(ended.body.campaign.turn.active, false);
  } finally {
    await close(server);
  }
});

test("campaign store fails closed on damaged persistence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eclipse-campaign-corrupt-"));
  const file = join(directory, "campaigns.json");
  await writeFile(file, '{"schemaVersion":"eclipse.campaign.v1","campaigns":[{"broken":true}]}');
  await assert.rejects(
    () => createCampaignStore({ filePath: file }),
    (error) => error.code === "campaign_storage_corrupt" && error.status === 503,
  );
});

test("campaign store rejects malformed nested game state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eclipse-campaign-nested-corrupt-"));
  const file = join(directory, "campaigns.json");
  const store = await createCampaignStore({ filePath: file });
  await store.create("owner", "Ведущий", "Проверка схемы");
  const persisted = JSON.parse(await readFile(file, "utf8"));
  persisted.campaigns[0].scene.background = "javascript:alert(1)";
  persisted.campaigns[0].actions.push({
    id: "action-12345678",
    actor: "Игрок",
    text: "Подмена",
    dice: { expr: "d20", rolls: [999999], modifier: 0, total: 999999 },
    createdAt: Date.now(),
  });
  await writeFile(file, JSON.stringify(persisted));
  await assert.rejects(
    () => createCampaignStore({ filePath: file }),
    (error) => error.code === "campaign_storage_corrupt" && error.status === 503,
  );
});
