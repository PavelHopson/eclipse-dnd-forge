import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSharedTableServer } from "../scripts/shared-table-server.mjs";

async function listen(dataFile) {
    const instance = await createSharedTableServer({ dataFile, staticRoot: join(tmpdir(), "shared-table-static") });
    await new Promise((resolve) => instance.server.listen(0, "127.0.0.1", resolve));
    const address = instance.server.address();
    return { ...instance, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function request(baseUrl, path, { key, method = "GET", body } = {}) {
    const response = await fetch(baseUrl + path, {
        method,
        headers: {
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
}

test("master and player complete a persistent shared-table turn with role isolation", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "eclivarium-shared-table-"));
    const dataFile = join(directory, "rooms.json");
    let runtime = await listen(dataFile);
    t.after(async () => {
        if (runtime.server.listening) await new Promise((resolve) => runtime.server.close(resolve));
        await rm(directory, { recursive: true, force: true });
    });

    const created = await request(runtime.baseUrl, "/api/shared-table/rooms", {
        method: "POST", body: { title: "Врата над туманной долиной" },
    });
    assert.equal(created.status, 201);
    const { room, masterKey, playerKey } = created.body;
    assert.equal(room.role, "master");
    assert.equal(room.scene.background, "/assets/scenes/dnd-gateway.png");
    assert.equal(JSON.stringify(created.body).includes("Hash"), false);

    const noKey = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}`);
    assert.equal(noKey.status, 401);
    const playerSceneWrite = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/scene`, {
        key: playerKey, method: "PUT", body: { title: "Подмена", description: "Игрок не может менять сцену.", baseRevision: 0 },
    });
    assert.equal(playerSceneWrite.status, 403);

    const scene = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/scene`, {
        key: masterKey, method: "PUT", body: { title: "Каменный порог", description: "В рунах проступает холодный синий свет.", baseRevision: 0 },
    });
    assert.equal(scene.status, 200);
    assert.equal(scene.body.room.revision, 1);

    const initiative = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/initiative`, {
        key: masterKey, method: "PUT",
        body: {
            entries: [{ id: "initiative-12345678", name: "Иара", value: 14, active: true }],
            baseRevision: 1,
        },
    });
    assert.equal(initiative.status, 200);
    assert.equal(initiative.body.room.initiative[0].value, 14);

    const character = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/characters`, {
        key: playerKey, method: "PUT",
        body: {
            characterId: "character-12345678",
            name: "Иара",
            summary: "Следопыт, который ищет след древнего механизма.",
            hp: 12,
            initiative: 3,
            baseRevision: 2,
        },
    });
    assert.equal(character.status, 200);
    assert.equal(character.body.room.characters[0].hp, 12);

    const playerInitiativeWrite = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/initiative`, {
        key: playerKey, method: "PUT", body: { entries: [], baseRevision: 2 },
    });
    assert.equal(playerInitiativeWrite.status, 403);

    const actionBody = { id: "action-12345678-abcd", actor: "Иара", text: "Осматриваю руны на арке", diceExpression: "d20+3" };
    const action = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/actions`, {
        key: playerKey, method: "POST", body: actionBody,
    });
    assert.equal(action.status, 201);
    assert.equal(action.body.action.actor, "Иара");
    assert.ok(action.body.action.dice.total >= 4 && action.body.action.dice.total <= 23);

    const staleResponse = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/responses`, {
        key: masterKey, method: "PUT",
        body: { actionId: action.body.action.id, text: "Устаревший ответ", baseRevision: 3 },
    });
    assert.equal(staleResponse.status, 409);

    const dmResponse = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/responses`, {
        key: masterKey, method: "PUT",
        body: { actionId: action.body.action.id, text: "Замок поддаётся, и за дверью загорается новая руна.", baseRevision: 4 },
    });
    assert.equal(dmResponse.status, 201);
    assert.equal(dmResponse.body.action.dmReply.text, "Замок поддаётся, и за дверью загорается новая руна.");

    const checkAction = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/actions`, {
        key: playerKey, method: "POST", body: { id: "action-12345678-check", actor: "Иара", text: "Проверяю руну", diceExpression: "d20" },
    });
    assert.equal(checkAction.status, 201);
    const playerCheck = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/checks`, {
        key: playerKey, method: "PUT", body: { actionId: checkAction.body.action.id, dc: 15, modifier: 2, mode: "normal", baseRevision: 6 },
    });
    assert.equal(playerCheck.status, 403);
    const masterCheck = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/checks`, {
        key: masterKey, method: "PUT", body: { actionId: checkAction.body.action.id, dc: 15, modifier: 2, mode: "advantage", baseRevision: 6 },
    });
    assert.equal(masterCheck.status, 201);
    assert.equal(masterCheck.body.action.resolution.mode, "advantage");
    assert.equal(masterCheck.body.action.dice.total, masterCheck.body.action.resolution.total);

    const start = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/initiative/start`, {
        key: masterKey, method: "PUT", body: { baseRevision: 7 },
    });
    assert.equal(start.status, 200);
    assert.equal(start.body.room.turn.active, true);
    const advance = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/initiative/advance`, {
        key: masterKey, method: "PUT", body: { baseRevision: 8 },
    });
    assert.equal(advance.status, 200);
    assert.equal(advance.body.room.turn.round, 2);
    const end = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/initiative/end`, {
        key: masterKey, method: "PUT", body: { baseRevision: 9 },
    });
    assert.equal(end.status, 200);
    assert.equal(end.body.room.turn.active, false);

    const playerResponse = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/responses`, {
        key: playerKey, method: "PUT",
        body: { actionId: action.body.action.id, text: "Подменяю ответ.", baseRevision: 5 },
    });
    assert.equal(playerResponse.status, 403);

    const repeatedResponse = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/responses`, {
        key: masterKey, method: "PUT",
        body: { actionId: action.body.action.id, text: "Замок поддаётся, и за дверью загорается новая руна.", baseRevision: 0 },
    });
    assert.equal(repeatedResponse.status, 200, "retrying the same DM response must be safe");

    const repeated = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}/actions`, {
        key: playerKey, method: "POST", body: actionBody,
    });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.room.actions.length, 2, "retry must not duplicate a turn");

    const masterView = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}`, { key: masterKey });
    assert.equal(masterView.status, 200);
    assert.equal(masterView.body.room.actions[0].text, actionBody.text);
    assert.equal(masterView.body.room.actions[0].dmReply.text, "Замок поддаётся, и за дверью загорается новая руна.");

    await new Promise((resolve) => runtime.server.close(resolve));
    runtime = await listen(dataFile);
    const reconnected = await request(runtime.baseUrl, `/api/shared-table/rooms/${room.roomId}`, { key: playerKey });
    assert.equal(reconnected.status, 200);
    assert.equal(reconnected.body.room.scene.title, "Каменный порог");
    assert.equal(reconnected.body.room.actions.length, 2);
    assert.equal(reconnected.body.room.initiative[0].name, "Иара");
    assert.equal(reconnected.body.room.turn.active, false);
    assert.equal(reconnected.body.room.characters[0].summary, "Следопыт, который ищет след древнего механизма.");
    assert.equal(reconnected.body.room.actions[0].dmReply.text, "Замок поддаётся, и за дверью загорается новая руна.");
});

test("shared-table API rejects mass assignment and malformed dice", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "eclivarium-shared-table-validation-"));
    const runtime = await listen(join(directory, "rooms.json"));
    t.after(async () => {
        await new Promise((resolve) => runtime.server.close(resolve));
        await rm(directory, { recursive: true, force: true });
    });
    const injected = await request(runtime.baseUrl, "/api/shared-table/rooms", {
        method: "POST", body: { title: "Безопасная сцена", role: "master" },
    });
    assert.equal(injected.status, 400);

    const created = await request(runtime.baseUrl, "/api/shared-table/rooms", {
        method: "POST", body: { title: "Безопасная сцена" },
    });
    const malformedResponse = await request(runtime.baseUrl, `/api/shared-table/rooms/${created.body.room.roomId}/responses`, {
        key: created.body.masterKey, method: "PUT",
        body: { actionId: "not-an-action", text: "", baseRevision: 0 },
    });
    assert.equal(malformedResponse.status, 400);
    const malformed = await request(runtime.baseUrl, `/api/shared-table/rooms/${created.body.room.roomId}/actions`, {
        key: created.body.playerKey, method: "POST",
        body: { id: "action-12345678", actor: "Иара", text: "Пробую", diceExpression: "d20+1d4" },
    });
    assert.equal(malformed.status, 400);
    assert.match(malformed.body.error, /брос|действ/i);
});

test("shared-table server fails closed for a damaged persisted action", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "eclivarium-shared-table-corrupt-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const dataFile = join(directory, "rooms.json");
    await writeFile(dataFile, JSON.stringify([{
        schemaVersion: "eclivarium.shared-table.v1",
        roomId: "room-123456789012",
        title: "Damaged",
        scene: { title: "Scene", description: "Description", background: "/assets/scenes/dnd-gateway.png" },
        actions: [{ id: "action-12345678", actor: "QA", text: "Broken", dice: {}, createdAt: 1 }],
        revision: 1, updatedAt: 1, masterHash: "a".repeat(64), playerHash: "b".repeat(64),
    }]));
    await assert.rejects(() => createSharedTableServer({ dataFile }), /storage is damaged/);
    assert.match(await (await import("node:fs/promises")).readFile(dataFile, "utf8"), /"dice":\{\}/, "damaged source must not be overwritten");
});

test("shared-table server fails closed for an incoherent d20 resolution", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "eclivarium-shared-table-resolution-corrupt-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const dataFile = join(directory, "rooms.json");
    await writeFile(dataFile, JSON.stringify([{
        schemaVersion: "eclivarium.shared-table.v1",
        roomId: "room-123456789012",
        title: "Damaged resolution",
        scene: { title: "Scene", description: "Description", background: "/assets/scenes/dnd-gateway.png" },
        actions: [{
            id: "action-12345678",
            actor: "QA",
            text: "Broken resolution",
            dice: { expr: "d20", rolls: [7, 18], modifier: 0, total: 18 },
            resolution: {
                dc: 10,
                modifier: 0,
                mode: "advantage",
                rolls: [7, 18],
                selected: 7,
                total: 7,
                natural: 7,
                outcome: "failure",
                success: false,
            },
            createdAt: 1,
        }],
        revision: 1,
        updatedAt: 1,
        masterHash: "a".repeat(64),
        playerHash: "b".repeat(64),
    }]));
    await assert.rejects(() => createSharedTableServer({ dataFile }), /storage is damaged/);
    assert.match(await (await import("node:fs/promises")).readFile(dataFile, "utf8"), /"selected":7/, "damaged source must not be overwritten");
});
