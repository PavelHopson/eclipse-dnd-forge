import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseDiceExpression, rollDice } from "../src/model/dice.ts";
import {
    MAX_SHARED_TABLE_ACTIONS,
    SHARED_TABLE_BACKGROUND,
    SHARED_TABLE_SCHEMA,
    isSharedTableRoomId,
    readCreateSharedTable,
    readCharacterUpsert,
    readInitiativeUpdate,
    readPlayerAction,
    readSceneUpdate,
    resolveD20Check,
} from "../src/model/dnd/sharedTableContract.ts";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_ROOMS = 50;
const DEFAULT_PORT = 5210;

const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
};

function tokenHash(token) {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

function sameHash(left, right) {
    if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function bearer(request) {
    const value = request.headers.authorization;
    return typeof value === "string" && value.startsWith("Bearer ") ? value.slice(7) : "";
}

function json(response, status, body) {
    const raw = JSON.stringify(body);
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(raw),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    });
    response.end(raw);
}

async function readJson(request) {
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) throw Object.assign(new Error("Ожидается JSON."), { status: 415 });
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Запрос слишком большой."), { status: 413 });
        chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw Object.assign(new Error("Некорректный JSON."), { status: 400 }); }
}

function publicSnapshot(room, role) {
    return {
        schemaVersion: SHARED_TABLE_SCHEMA,
        roomId: room.roomId,
        title: room.title,
        scene: room.scene,
        actions: room.actions,
        revision: room.revision,
        updatedAt: room.updatedAt,
        role,
        initiative: room.initiative,
        characters: room.characters,
    };
}

function exactKeys(value, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validated(read) {
    try { return read(); }
    catch (error) { throw Object.assign(error instanceof Error ? error : new Error("Некорректные данные."), { status: 400 }); }
}

function validD20Resolution(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)
        || !["dc", "modifier", "mode", "rolls", "selected", "total", "natural", "outcome", "success"].every((key) => Object.prototype.hasOwnProperty.call(value, key))
        || Object.keys(value).length !== 9
        || !Number.isSafeInteger(value.dc) || value.dc < 1 || value.dc > 40
        || !Number.isSafeInteger(value.modifier) || value.modifier < -20 || value.modifier > 20
        || (value.mode !== "normal" && value.mode !== "advantage" && value.mode !== "disadvantage")
        || !Array.isArray(value.rolls)
        || !Number.isSafeInteger(value.selected) || value.selected < 1 || value.selected > 20
        || !Number.isSafeInteger(value.total) || value.total < -19 || value.total > 40
        || !Number.isSafeInteger(value.natural) || value.natural < 1 || value.natural > 20
        || (value.outcome !== "success" && value.outcome !== "failure" && value.outcome !== "critical-success" && value.outcome !== "critical-failure")
        || typeof value.success !== "boolean") return false;

    const expectedRollCount = value.mode === "normal" ? 1 : 2;
    if (value.rolls.length !== expectedRollCount
        || !value.rolls.every((roll) => Number.isSafeInteger(roll) && roll >= 1 && roll <= 20)) return false;

    const selected = value.mode === "advantage" ? Math.max(...value.rolls) : value.mode === "disadvantage" ? Math.min(...value.rolls) : value.rolls[0];
    const expectedOutcome = value.natural === 20 ? "critical-success"
        : value.natural === 1 ? "critical-failure"
            : value.total >= value.dc ? "success" : "failure";
    return value.selected === selected
        && value.natural === selected
        && value.total === selected + value.modifier
        && value.outcome === expectedOutcome
        && value.success === (expectedOutcome === "success" || expectedOutcome === "critical-success");
}

function validActionRecord(action) {
    const hasResolution = action && Object.prototype.hasOwnProperty.call(action, "resolution");
    return exactKeys(action, hasResolution ? ["id", "actor", "text", "dice", "resolution", "createdAt"] : ["id", "actor", "text", "dice", "createdAt"])
        && /^action-[a-zA-Z0-9-]{8,72}$/.test(action.id)
        && typeof action.actor === "string" && action.actor.length >= 2 && action.actor.length <= 40
        && typeof action.text === "string" && action.text.length >= 2 && action.text.length <= 240
        && exactKeys(action.dice, ["expr", "rolls", "modifier", "total"])
        && typeof action.dice.expr === "string" && !!parseDiceExpression(action.dice.expr)
        && Array.isArray(action.dice.rolls) && action.dice.rolls.length >= 1 && action.dice.rolls.length <= 100
        && action.dice.rolls.every((roll) => Number.isSafeInteger(roll) && roll >= 1 && roll <= 1000)
        && Number.isSafeInteger(action.dice.modifier) && Math.abs(action.dice.modifier) <= 1000
        && Number.isSafeInteger(action.dice.total) && Math.abs(action.dice.total) <= 101000
        && (!hasResolution || validD20Resolution(action.resolution))
        && Number.isSafeInteger(action.createdAt) && action.createdAt >= 0;
}

function validRoomRecord(room) {
    return exactKeys(room, ["schemaVersion", "roomId", "title", "scene", "actions", "initiative", "characters", "revision", "updatedAt", "masterHash", "playerHash"])
        && room.schemaVersion === SHARED_TABLE_SCHEMA && isSharedTableRoomId(room.roomId)
        && typeof room.title === "string" && room.title.length <= 80
        && exactKeys(room.scene, ["title", "description", "background"])
        && room.scene?.background === SHARED_TABLE_BACKGROUND
        && typeof room.scene.title === "string" && room.scene.title.length <= 100
        && typeof room.scene.description === "string" && room.scene.description.length <= 800
        && Array.isArray(room.actions) && room.actions.length <= MAX_SHARED_TABLE_ACTIONS
        && room.actions.every(validActionRecord)
        && Array.isArray(room.initiative) && room.initiative.length <= 100
        && room.initiative.every((entry) => exactKeys(entry, ["id", "name", "value", "active"])
            && /^initiative-[a-zA-Z0-9-]{8,72}$/.test(entry.id)
            && typeof entry.name === "string" && entry.name.length >= 1 && entry.name.length <= 80
            && Number.isSafeInteger(entry.value) && entry.value >= -100 && entry.value <= 100
            && typeof entry.active === "boolean")
        && new Set(room.initiative.map((entry) => entry.id)).size === room.initiative.length
        && Array.isArray(room.characters) && room.characters.length <= 200
        && room.characters.every((character) => exactKeys(character, ["characterId", "name", "summary", "hp", "initiative"])
            && /^character-[a-zA-Z0-9-]{8,72}$/.test(character.characterId)
            && typeof character.name === "string" && character.name.length >= 2 && character.name.length <= 80
            && typeof character.summary === "string" && character.summary.length <= 1_000
            && Number.isSafeInteger(character.hp) && character.hp >= 0 && character.hp <= 1_000
            && Number.isSafeInteger(character.initiative) && character.initiative >= -100 && character.initiative <= 100)
        && new Set(room.characters.map((character) => character.characterId)).size === room.characters.length
        && Number.isSafeInteger(room.revision) && room.revision >= 0
        && Number.isSafeInteger(room.updatedAt) && room.updatedAt >= 0
        && /^[a-f0-9]{64}$/.test(room.masterHash) && /^[a-f0-9]{64}$/.test(room.playerHash);
}

export async function createSharedTableServer({
    dataFile = join(homedir(), ".eclivarium", "shared-table-rooms.json"),
    staticRoot = resolve("build"),
    clock = () => Date.now(),
    tokenBytes = () => randomBytes(32),
    random = Math.random,
} = {}) {
    const resolvedDataFile = resolve(dataFile);
    const resolvedStaticRoot = resolve(staticRoot);
    const rooms = new Map();
    const rateBuckets = new Map();

    if (existsSync(resolvedDataFile)) {
        try {
            const parsed = JSON.parse(await readFile(resolvedDataFile, "utf8"));
            if (!Array.isArray(parsed) || parsed.length > MAX_ROOMS || !parsed.every(validRoomRecord)) throw new Error("invalid room data");
            parsed.forEach((room) => rooms.set(room.roomId, room));
        } catch {
            throw new Error("Shared Table storage is damaged. Move the file aside before starting; it was not overwritten.");
        }
    }

    async function persist() {
        await mkdir(dirname(resolvedDataFile), { recursive: true });
        const temporary = `${resolvedDataFile}.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify([...rooms.values()], null, 2), { encoding: "utf8", mode: 0o600 });
        await rename(temporary, resolvedDataFile);
    }

    function rateLimited(request, limit = 120) {
        const address = request.socket.remoteAddress ?? "local";
        const minute = Math.floor(clock() / 60_000);
        const key = `${address}:${minute}`;
        const count = (rateBuckets.get(key) ?? 0) + 1;
        rateBuckets.clear();
        rateBuckets.set(key, count);
        return count > limit;
    }

    function authorize(room, request, requiredRole) {
        const supplied = tokenHash(bearer(request));
        const role = sameHash(supplied, room.masterHash) ? "master"
            : sameHash(supplied, room.playerHash) ? "player" : null;
        if (!role) throw Object.assign(new Error("Ссылка-приглашение недействительна."), { status: 401 });
        if (requiredRole && role !== requiredRole) throw Object.assign(new Error("Это действие доступно только ведущему."), { status: 403 });
        return role;
    }

    async function serveStatic(request, response, url) {
        const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
        const target = resolve(resolvedStaticRoot, `.${requested}`);
        if (target !== resolvedStaticRoot && !target.startsWith(`${resolvedStaticRoot}${sep}`)) {
            json(response, 404, { error: "not_found" }); return;
        }
        let file = target;
        try {
            if ((await stat(file)).isDirectory()) file = join(file, "index.html");
        } catch {
            file = join(resolvedStaticRoot, "index.html");
        }
        const fileStat = await stat(file);
        response.writeHead(200, {
            "Content-Type": contentTypes[extname(file).toLowerCase()] ?? "application/octet-stream",
            "Content-Length": fileStat.size,
            "Cache-Control": extname(file) === ".html" ? "no-store" : "public, max-age=3600",
            "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
        });
        createReadStream(file).pipe(response);
    }

    const server = createServer(async (request, response) => {
        try {
            if (!request.url || rateLimited(request)) throw Object.assign(new Error("Слишком много запросов. Повторите через минуту."), { status: 429 });
            const url = new URL(request.url, "http://127.0.0.1");
            if (url.pathname === "/api/shared-table/health" && request.method === "GET") {
                json(response, 200, { status: "ok" }); return;
            }
            if (url.pathname === "/api/shared-table/rooms" && request.method === "POST") {
                if (rooms.size >= MAX_ROOMS) throw Object.assign(new Error("Достигнут локальный лимит приключений."), { status: 409 });
                const createInput = await readJson(request);
                const { title } = validated(() => readCreateSharedTable(createInput));
                const masterKey = tokenBytes().toString("base64url");
                const playerKey = tokenBytes().toString("base64url");
                const roomId = `room-${tokenBytes().subarray(0, 12).toString("base64url")}`;
                const now = clock();
                const room = {
                    schemaVersion: SHARED_TABLE_SCHEMA,
                    roomId,
                    title,
                    scene: {
                        title: "У врат затерянного святилища",
                        description: "Туман расходится над долиной. В каменной арке горит тёплый свет, а за порогом слышится гул древнего механизма.",
                        background: SHARED_TABLE_BACKGROUND,
                    },
                    actions: [], initiative: [], characters: [], revision: 0, updatedAt: now,
                    masterHash: tokenHash(masterKey), playerHash: tokenHash(playerKey),
                };
                rooms.set(roomId, room);
                await persist();
                json(response, 201, { room: publicSnapshot(room, "master"), masterKey, playerKey }); return;
            }
            const match = url.pathname.match(/^\/api\/shared-table\/rooms\/(room-[a-zA-Z0-9_-]{12,80})(?:\/(scene|actions|initiative|characters))?$/);
            if (match) {
                const room = rooms.get(match[1]);
                if (!room) throw Object.assign(new Error("Приключение не найдено."), { status: 404 });
                const resource = match[2] ?? "room";
                if (request.method === "GET" && resource === "room") {
                    const role = authorize(room, request);
                    json(response, 200, { room: publicSnapshot(room, role) }); return;
                }
                if (request.method === "PUT" && resource === "scene") {
                    authorize(room, request, "master");
                    const sceneInput = await readJson(request);
                    const input = validated(() => readSceneUpdate(sceneInput));
                    if (input.baseRevision !== room.revision) throw Object.assign(new Error("Сцена уже изменилась. Загружена свежая версия."), { status: 409 });
                    room.scene = { title: input.title, description: input.description, background: SHARED_TABLE_BACKGROUND };
                    room.revision += 1; room.updatedAt = clock();
                    await persist();
                    json(response, 200, { room: publicSnapshot(room, "master") }); return;
                }
                if (request.method === "POST" && resource === "actions") {
                    authorize(room, request, "player");
                    const actionInput = await readJson(request);
                    const input = validated(() => readPlayerAction(actionInput));
                    const existing = room.actions.find((action) => action.id === input.id);
                    if (existing) { json(response, 200, { room: publicSnapshot(room, "player"), action: existing }); return; }
                    const parsed = parseDiceExpression(input.diceExpression);
                    if (!parsed) throw Object.assign(new Error("Некорректная формула броска."), { status: 400 });
                    let resolution;
                    let dice;
                    if (input.resolution) {
                        if (parsed.count !== 1 || parsed.sides !== 20 || parsed.modifier !== 0) {
                            throw Object.assign(new Error("Проверка d20 должна использовать формулу d20 без встроенного модификатора."), { status: 400 });
                        }
                        resolution = resolveD20Check(input.resolution, random);
                        dice = { expr: input.diceExpression, rolls: resolution.rolls, modifier: resolution.modifier, total: resolution.total };
                    } else if (parsed.count === 1 && parsed.sides === 20) {
                        if (parsed.modifier < -20 || parsed.modifier > 20) {
                            throw Object.assign(new Error("Модификатор d20 должен быть от −20 до 20."), { status: 400 });
                        }
                        resolution = resolveD20Check({ dc: 10, modifier: parsed.modifier, mode: "normal" }, random);
                        dice = { expr: input.diceExpression, rolls: resolution.rolls, modifier: resolution.modifier, total: resolution.total };
                    } else {
                        dice = rollDice(input.diceExpression);
                    }
                    const action = { id: input.id, actor: input.actor, text: input.text, dice, ...(resolution ? { resolution } : {}), createdAt: clock() };
                    room.actions = [...room.actions, action].slice(-MAX_SHARED_TABLE_ACTIONS);
                    room.revision += 1; room.updatedAt = clock();
                    await persist();
                    json(response, 201, { room: publicSnapshot(room, "player"), action }); return;
                }
                if (request.method === "PUT" && resource === "initiative") {
                    authorize(room, request, "master");
                    const initiativeBody = await readJson(request);
                    const input = validated(() => readInitiativeUpdate(initiativeBody));
                    if (input.baseRevision !== room.revision) throw Object.assign(new Error("Инициатива уже изменилась. Загружена свежая версия."), { status: 409 });
                    room.initiative = input.entries;
                    room.revision += 1; room.updatedAt = clock();
                    await persist();
                    json(response, 200, { room: publicSnapshot(room, "master") }); return;
                }
                if (request.method === "PUT" && resource === "characters") {
                    authorize(room, request, "player");
                    const characterBody = await readJson(request);
                    const input = validated(() => readCharacterUpsert(characterBody));
                    if (input.baseRevision !== room.revision) throw Object.assign(new Error("Лист уже изменился. Загружена свежая версия."), { status: 409 });
                    const { baseRevision: _baseRevision, ...character } = input;
                    room.characters = [...room.characters.filter((entry) => entry.characterId !== character.characterId), character];
                    room.revision += 1; room.updatedAt = clock();
                    await persist();
                    json(response, 200, { room: publicSnapshot(room, "player"), character }); return;
                }
                throw Object.assign(new Error("Метод недоступен."), { status: 405 });
            }
            if (url.pathname.startsWith("/api/")) throw Object.assign(new Error("API endpoint не найден."), { status: 404 });
            await serveStatic(request, response, url);
        } catch (error) {
            const status = Number.isInteger(error?.status) ? error.status : 500;
            const message = status >= 500 ? "Shared Table временно недоступен." : error.message;
            json(response, status, { error: message });
        }
    });

    return { server, rooms, dataFile: resolvedDataFile, staticRoot: resolvedStaticRoot };
}

function argument(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const port = Number(argument("--port", String(DEFAULT_PORT)));
    const host = argument("--host", "127.0.0.1");
    const root = argument("--root", resolve("build"));
    const data = argument("--data", join(homedir(), ".eclivarium", "shared-table-rooms.json"));
    if (host !== "127.0.0.1" && host !== "::1") throw new Error("Shared Table binds to loopback only in this local slice.");
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || !isAbsolute(resolve(root))) throw new Error("Invalid server arguments.");
    const { server, dataFile } = await createSharedTableServer({ dataFile: data, staticRoot: root });
    server.listen(port, host, () => {
        console.log(`Eclivarium Shared Table: http://${host}:${port}/#/party`);
        console.log(`Room state: ${dataFile}`);
    });
}
