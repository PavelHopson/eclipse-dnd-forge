import type { DiceRollResult } from "../dice";

export const SHARED_TABLE_SCHEMA = "eclivarium.shared-table.v1" as const;
export const SHARED_TABLE_BACKGROUND = "/assets/scenes/dnd-gateway.png";
export const MAX_SHARED_TABLE_ACTIONS = 120;

export type SharedTableRole = "master" | "player";
export type D20Mode = "normal" | "advantage" | "disadvantage";

export interface D20CheckInput {
    dc: number;
    modifier: number;
    mode: D20Mode;
}

export interface D20Resolution extends D20CheckInput {
    rolls: [number] | [number, number];
    selected: number;
    total: number;
    natural: number;
    outcome: "success" | "failure" | "critical-success" | "critical-failure";
    success: boolean;
}

export interface SharedTableScene {
    title: string;
    description: string;
    background: typeof SHARED_TABLE_BACKGROUND;
}

export interface SharedTableAction {
    id: string;
    actor: string;
    text: string;
    dice: DiceRollResult;
    resolution?: D20Resolution;
    createdAt: number;
}

export interface SharedTableSnapshot {
    schemaVersion: typeof SHARED_TABLE_SCHEMA;
    roomId: string;
    title: string;
    scene: SharedTableScene;
    actions: SharedTableAction[];
    revision: number;
    updatedAt: number;
    role: SharedTableRole;
    initiative: Array<{ id: string; name: string; value: number; active: boolean }>;
    characters: Array<{ characterId: string; name: string; summary: string; hp: number; initiative: number }>;
}

function cleanText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") return "";
    return Array.from(value, (character) => {
        const code = character.codePointAt(0) ?? 0;
        const blocked = code <= 31 || (code >= 127 && code <= 159)
            || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
        return blocked ? " " : character;
    }).join("").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function exactRecord(value: unknown, keys: string[]): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function readCreateSharedTable(value: unknown): { title: string } {
    if (!exactRecord(value, ["title"])) throw new Error("Некорректные параметры приключения.");
    const title = cleanText(value.title, 80);
    if (title.length < 3) throw new Error("Название приключения должно содержать минимум 3 символа.");
    return { title };
}

export function readSceneUpdate(value: unknown): { title: string; description: string; baseRevision: number } {
    if (!exactRecord(value, ["title", "description", "baseRevision"])) throw new Error("Некорректное обновление сцены.");
    const title = cleanText(value.title, 100);
    const description = cleanText(value.description, 800);
    if (!title || !description || !Number.isSafeInteger(value.baseRevision) || (value.baseRevision as number) < 0) {
        throw new Error("Заполните название и описание актуальной сцены.");
    }
    return { title, description, baseRevision: value.baseRevision as number };
}

export function readPlayerAction(value: unknown): { id: string; actor: string; text: string; diceExpression: string; resolution?: D20CheckInput } {
    const hasResolution = exactRecord(value, ["id", "actor", "text", "diceExpression", "resolution"]);
    if (!hasResolution && !exactRecord(value, ["id", "actor", "text", "diceExpression"])) throw new Error("Некорректное действие игрока.");
    const id = cleanText(value.id, 80);
    const actor = cleanText(value.actor, 40);
    const text = cleanText(value.text, 240);
    const diceExpression = cleanText(value.diceExpression, 16).toLowerCase();
    if (!/^action-[a-zA-Z0-9-]{8,72}$/.test(id) || actor.length < 2 || text.length < 2) {
        throw new Error("Укажите персонажа и его действие.");
    }
    if (!/^(?:\d{0,2})d\d{1,4}(?:[+-]\d{1,4})?$/.test(diceExpression)) {
        throw new Error("Используйте бросок вида d20, d20+5 или 2d6.");
    }
    const resolution = hasResolution ? readD20Check(value.resolution) : undefined;
    return resolution ? { id, actor, text, diceExpression, resolution } : { id, actor, text, diceExpression };
}

function readD20Check(value: unknown): D20CheckInput {
    if (!exactRecord(value, ["dc", "modifier", "mode"])) throw new Error("Некорректная проверка d20.");
    const dc = value.dc as number;
    const modifier = value.modifier as number;
    const mode = value.mode as D20Mode;
    if (!Number.isSafeInteger(dc) || dc < 1 || dc > 40
        || !Number.isSafeInteger(modifier) || modifier < -20 || modifier > 20
        || mode !== "normal" && mode !== "advantage" && mode !== "disadvantage") {
        throw new Error("Проверка d20 должна содержать DC 1–40, модификатор −20…20 и режим броска.");
    }
    return { dc, modifier, mode };
}

export function resolveD20Check(input: D20CheckInput, random: () => number = Math.random): D20Resolution {
    const rolls = input.mode === "normal"
        ? [rollD20(random)] as [number]
        : [rollD20(random), rollD20(random)] as [number, number];
    const selected = input.mode === "advantage" ? Math.max(...rolls) : input.mode === "disadvantage" ? Math.min(...rolls) : rolls[0];
    const natural = selected;
    const total = selected + input.modifier;
    const outcome = natural === 20 ? "critical-success"
        : natural === 1 ? "critical-failure"
            : total >= input.dc ? "success" : "failure";
    return { ...input, rolls, selected, total, natural, outcome, success: outcome === "success" || outcome === "critical-success" };
}

function rollD20(random: () => number): number {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("Источник случайности вернул недопустимое значение.");
    return 1 + Math.floor(sample * 20);
}

type InitiativeEntry = { id: string; name: string; value: number; active: boolean };

function readInitiativeEntries(value: unknown): InitiativeEntry[] {
    if (!Array.isArray(value) || value.length > 100) throw new Error("Некорректный список инициативы.");
    const ids = new Set<string>();
    return value.map((entry) => {
        if (!exactRecord(entry, ["id", "name", "value", "active"])) throw new Error("Некорректный участник инициативы.");
        const id = cleanText(entry.id, 80);
        const name = cleanText(entry.name, 80);
        const valueNumber = entry.value as number;
        if (!/^initiative-[a-zA-Z0-9-]{8,72}$/.test(id) || ids.has(id)
            || name.length < 1 || !Number.isSafeInteger(valueNumber) || valueNumber < -100 || valueNumber > 100
            || typeof entry.active !== "boolean") {
            throw new Error("Проверьте имя, значение и уникальность инициативы.");
        }
        ids.add(id);
        return { id, name, value: valueNumber, active: entry.active };
    });
}

export function readInitiativeUpdate(value: unknown): { entries: InitiativeEntry[]; baseRevision: number } {
    if (!exactRecord(value, ["entries", "baseRevision"])) {
        throw new Error("Некорректное обновление инициативы.");
    }
    const baseRevision = value.baseRevision as number;
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) throw new Error("Некорректное обновление инициативы.");
    return { entries: readInitiativeEntries(value.entries), baseRevision };
}

export function readCharacterUpsert(value: unknown): {
    characterId: string;
    name: string;
    summary: string;
    hp: number;
    initiative: number;
    baseRevision: number;
} {
    if (!exactRecord(value, ["characterId", "name", "summary", "hp", "initiative", "baseRevision"])) {
        throw new Error("Некорректный лист персонажа.");
    }
    const baseRevision = value.baseRevision as number;
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) throw new Error("Некорректный лист персонажа.");
    const characterId = cleanText(value.characterId, 80);
    const name = cleanText(value.name, 80);
    const summary = cleanText(value.summary, 1_000);
    const hp = value.hp as number;
    const initiative = value.initiative as number;
    if (!/^character-[a-zA-Z0-9-]{8,72}$/.test(characterId) || name.length < 2
        || !Number.isSafeInteger(hp) || hp < 0 || hp > 1_000
        || !Number.isSafeInteger(initiative) || initiative < -100 || initiative > 100) {
        throw new Error("Заполните имя, HP и инициативу допустимыми целыми числами.");
    }
    return { characterId, name, summary, hp, initiative, baseRevision };
}

export function isSharedTableRoomId(value: unknown): value is string {
    return typeof value === "string" && /^room-[a-zA-Z0-9_-]{12,80}$/.test(value);
}
