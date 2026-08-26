export const MAP_STORY_PIN_LIBRARY_SCHEMA = "eclipse.map-story-pins.v1" as const;
export const MAX_MAP_STORY_PINS = 128;
export const MAX_MAP_STORY_PINS_PER_MAP = 32;
export const MAX_MAP_STORY_PIN_LIBRARY_BYTES = 96 * 1024;

export type MapStoryPinKind = "scene" | "clue" | "danger" | "loot" | "portal";
export type MapStoryPinVisibility = "table" | "gm";

export type MapStoryPin = {
    id: string;
    mapId: string;
    x: number;
    y: number;
    label: string;
    note: string;
    kind: MapStoryPinKind;
    visibility: MapStoryPinVisibility;
    createdAt: number;
    updatedAt: number;
};

export type MapStoryPinLibrary = {
    schemaVersion: typeof MAP_STORY_PIN_LIBRARY_SCHEMA;
    pins: MapStoryPin[];
};

const SAFE_ID = /^[a-z0-9][a-z0-9-]{2,79}$/;
const PIN_KINDS: MapStoryPinKind[] = ["scene", "clue", "danger", "loot", "portal"];
const PIN_VISIBILITIES: MapStoryPinVisibility[] = ["table", "gm"];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function cleanText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") return "";
    return Array.from(value, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        const isControl = codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
        const isBidiOverride = (codePoint >= 0x202a && codePoint <= 0x202e)
            || (codePoint >= 0x2066 && codePoint <= 0x2069);
        return isControl || isBidiOverride ? " " : character;
    }).join("").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function parsePin(value: unknown, index: number): MapStoryPin {
    if (!isRecord(value) || !hasExactKeys(value, [
        "id", "mapId", "x", "y", "label", "note", "kind", "visibility", "createdAt", "updatedAt",
    ])) throw new Error(`Story pin ${index + 1} has unknown fields.`);

    const id = cleanText(value.id, 80);
    const mapId = cleanText(value.mapId, 80);
    const label = cleanText(value.label, 60);
    const note = cleanText(value.note, 280);
    if (!SAFE_ID.test(id) || !SAFE_ID.test(mapId)) throw new Error("Story pin has an invalid id or mapId.");
    if (!label) throw new Error("Story pin label is required.");
    if (!Number.isInteger(value.x) || !Number.isInteger(value.y)
        || (value.x as number) < 0 || (value.x as number) > 10000
        || (value.y as number) < 0 || (value.y as number) > 10000) {
        throw new Error("Story pin coordinates must be integers between 0 and 10000.");
    }
    if (!PIN_KINDS.includes(value.kind as MapStoryPinKind)) throw new Error("Story pin has an invalid kind.");
    if (!PIN_VISIBILITIES.includes(value.visibility as MapStoryPinVisibility)) {
        throw new Error("Story pin has an invalid visibility.");
    }
    if (!Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.updatedAt)
        || (value.createdAt as number) < 0 || (value.updatedAt as number) < (value.createdAt as number)) {
        throw new Error("Story pin has invalid timestamps.");
    }
    return {
        id,
        mapId,
        x: value.x as number,
        y: value.y as number,
        label,
        note,
        kind: value.kind as MapStoryPinKind,
        visibility: value.visibility as MapStoryPinVisibility,
        createdAt: value.createdAt as number,
        updatedAt: value.updatedAt as number,
    };
}

export function emptyMapStoryPinLibrary(): MapStoryPinLibrary {
    return { schemaVersion: MAP_STORY_PIN_LIBRARY_SCHEMA, pins: [] };
}

export function readMapStoryPinLibrary(raw: string): MapStoryPinLibrary {
    if (new TextEncoder().encode(raw).byteLength > MAX_MAP_STORY_PIN_LIBRARY_BYTES) {
        throw new Error("Story pin library exceeds 96 KB.");
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Story pin library contains invalid JSON.");
    }
    if (!isRecord(parsed) || !hasExactKeys(parsed, ["schemaVersion", "pins"])
        || parsed.schemaVersion !== MAP_STORY_PIN_LIBRARY_SCHEMA || !Array.isArray(parsed.pins)) {
        throw new Error("Story pin library has unknown fields or an unsupported schema.");
    }
    if (parsed.pins.length > MAX_MAP_STORY_PINS) {
        throw new Error("Story pin library must contain no more than 128 pins.");
    }

    const ids = new Set<string>();
    const perMap = new Map<string, number>();
    const pins = parsed.pins.map((value, index) => {
        const pin = parsePin(value, index);
        if (ids.has(pin.id)) throw new Error("Story pin library contains a duplicate pin id.");
        ids.add(pin.id);
        const count = (perMap.get(pin.mapId) ?? 0) + 1;
        if (count > MAX_MAP_STORY_PINS_PER_MAP) throw new Error("A map must contain no more than 32 story pins.");
        perMap.set(pin.mapId, count);
        return pin;
    });
    return { schemaVersion: MAP_STORY_PIN_LIBRARY_SCHEMA, pins };
}

export function createMapStoryPin(
    input: Omit<MapStoryPin, "createdAt" | "updatedAt">,
    now = Date.now(),
): MapStoryPin {
    return readMapStoryPinLibrary(JSON.stringify({
        schemaVersion: MAP_STORY_PIN_LIBRARY_SCHEMA,
        pins: [{ ...input, createdAt: now, updatedAt: now }],
    })).pins[0];
}

export function serializeMapStoryPinLibrary(library: MapStoryPinLibrary): string {
    return JSON.stringify(readMapStoryPinLibrary(JSON.stringify(library)), null, 2) + "\n";
}
