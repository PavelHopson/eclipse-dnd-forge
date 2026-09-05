export const LIVING_ATLAS_SCHEMA = "eclivarium.living-atlas.v1" as const;
export const MAX_LIVING_ATLAS_FILE_BYTES = 1024 * 1024;
export const MAX_LIVING_ATLAS_SHAPES = 500;
export const MAX_ATLAS_LAYERS = 12;
export const BASE_ATLAS_LAYER_ID = "layer-base";
export type AtlasLayer = { id: string; name: string; visible: boolean; locked: boolean };
export const MIN_LIVING_ATLAS_CELLS = 8;
export const MAX_LIVING_ATLAS_CELLS = 120;

export type LivingAtlasTool = "select" | "pan" | "room" | "corridor" | "wall" | "door";
export type LivingAtlasShapeKind = Exclude<LivingAtlasTool, "select" | "pan">;

export type LivingAtlasRoom = {
    id: string;
    layerId?: string;
    kind: "room";
    x: number;
    y: number;
    width: number;
    height: number;
};

export type LivingAtlasLine = {
    id: string;
    layerId?: string;
    kind: "corridor" | "wall";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
};

export type LivingAtlasDoor = {
    id: string;
    layerId?: string;
    kind: "door";
    x: number;
    y: number;
    rotation: 0 | 90;
};

export type LivingAtlasShape = LivingAtlasRoom | LivingAtlasLine | LivingAtlasDoor;

export type LivingAtlasDocument = {
    schemaVersion: typeof LIVING_ATLAS_SCHEMA;
    id: string;
    name: string;
    widthCells: number;
    heightCells: number;
    grid: "square";
    shapes: LivingAtlasShape[];
    layers?: AtlasLayer[];
    createdAt: number;
    updatedAt: number;
    source?: "imported";
};

const SAFE_ID = /^[a-z0-9][a-z0-9-]{2,79}$/;

/** Legacy v1 projects use a stable implicit base; visibility is NOT an access control. */
export function atlasLayers(document: LivingAtlasDocument): AtlasLayer[] {
    return document.layers ?? [{ id: BASE_ATLAS_LAYER_ID, name: "Основа", visible: true, locked: false }];
}

export function shapeLayerId(shape: LivingAtlasShape): string {
    return shape.layerId ?? BASE_ATLAS_LAYER_ID;
}

export function atlasVisibleShapes(document: LivingAtlasDocument): LivingAtlasShape[] {
    return atlasLayers(document).filter((layer) => layer.visible)
        .flatMap((layer) => document.shapes.filter((shape) => shapeLayerId(shape) === layer.id));
}

export function atlasEditableShapes(document: LivingAtlasDocument): LivingAtlasShape[] {
    const allowed = new Set(atlasLayers(document).filter((layer) => layer.visible && !layer.locked).map((layer) => layer.id));
    return document.shapes.filter((shape) => allowed.has(shapeLayerId(shape)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
    const actualKeys = Object.keys(value).sort();
    const sortedExpected = [...expectedKeys].sort();
    return actualKeys.length === sortedExpected.length
        && actualKeys.every((key, index) => key === sortedExpected[index]);
}

function cleanText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") return "";
    return Array.from(value, (character) => {
        const point = character.codePointAt(0) ?? 0;
        const isControl = point <= 31 || (point >= 127 && point <= 159);
        const isBidiOverride = (point >= 0x202a && point <= 0x202e)
            || (point >= 0x2066 && point <= 0x2069);
        return isControl || isBidiOverride ? " " : character;
    }).join("").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function parseInteger(value: unknown, minimum: number, maximum: number, label: string): number {
    if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
        throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
    }
    return value as number;
}

function parseShape(value: unknown, documentWidth: number, documentHeight: number): LivingAtlasShape {
    if (!isRecord(value) || typeof value.kind !== "string") {
        throw new Error("Living Atlas shape is invalid.");
    }
    const id = cleanText(value.id, 80);
    if (!SAFE_ID.test(id)) throw new Error("Living Atlas shape has an invalid id.");
    const layerKeys = "layerId" in value ? ["layerId"] : [];
    if (layerKeys.length && (typeof value.layerId !== "string" || !SAFE_ID.test(value.layerId))) {
        throw new Error("Living Atlas shape has an invalid layer id.");
    }
    const layer = layerKeys.length ? { layerId: value.layerId as string } : {};

    if (value.kind === "room") {
        if (!hasExactKeys(value, ["id", "kind", "x", "y", "width", "height", ...layerKeys])) {
            throw new Error("Living Atlas room has unknown fields.");
        }
        const x = parseInteger(value.x, 0, documentWidth - 1, "Room x");
        const y = parseInteger(value.y, 0, documentHeight - 1, "Room y");
        const width = parseInteger(value.width, 1, documentWidth, "Room width");
        const height = parseInteger(value.height, 1, documentHeight, "Room height");
        if (x + width > documentWidth || y + height > documentHeight) {
            throw new Error("Living Atlas room exceeds the canvas bounds.");
        }
        return { id, ...layer, kind: "room", x, y, width, height };
    }

    if (value.kind === "corridor" || value.kind === "wall") {
        if (!hasExactKeys(value, ["id", "kind", "x1", "y1", "x2", "y2", "width", ...layerKeys])) {
            throw new Error("Living Atlas line has unknown fields.");
        }
        return {
            id,
            ...layer,
            kind: value.kind,
            x1: parseInteger(value.x1, 0, documentWidth, "Line x1"),
            y1: parseInteger(value.y1, 0, documentHeight, "Line y1"),
            x2: parseInteger(value.x2, 0, documentWidth, "Line x2"),
            y2: parseInteger(value.y2, 0, documentHeight, "Line y2"),
            width: parseInteger(value.width, 1, value.kind === "corridor" ? 6 : 2, "Line width"),
        };
    }

    if (value.kind === "door") {
        if (!hasExactKeys(value, ["id", "kind", "x", "y", "rotation", ...layerKeys])) {
            throw new Error("Living Atlas door has unknown fields.");
        }
        if (value.rotation !== 0 && value.rotation !== 90) {
            throw new Error("Living Atlas door rotation must be 0 or 90 degrees.");
        }
        return {
            id,
            ...layer,
            kind: "door",
            x: parseInteger(value.x, 0, documentWidth, "Door x"),
            y: parseInteger(value.y, 0, documentHeight, "Door y"),
            rotation: value.rotation,
        };
    }

    throw new Error("Living Atlas shape kind is not supported.");
}

export function createLivingAtlasId(prefix = "atlas"): string {
    const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function createEmptyLivingAtlasDocument(
    name = "Новая карта",
    widthCells = 30,
    heightCells = 20,
    now = Date.now(),
): LivingAtlasDocument {
    return readLivingAtlasDocument(JSON.stringify({
        schemaVersion: LIVING_ATLAS_SCHEMA,
        id: createLivingAtlasId(),
        name,
        widthCells,
        heightCells,
        grid: "square",
        shapes: [],
        createdAt: now,
        updatedAt: now,
    }));
}

export function readLivingAtlasDocument(raw: string): LivingAtlasDocument {
    if (new TextEncoder().encode(raw).byteLength > MAX_LIVING_ATLAS_FILE_BYTES) {
        throw new Error("Living Atlas project exceeds 1 MB.");
    }
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        throw new Error("Living Atlas project contains invalid JSON.");
    }
    if (!isRecord(value) || !hasExactKeys(value, [
        "schemaVersion", "id", "name", "widthCells", "heightCells", "grid", "shapes", "createdAt", "updatedAt", ...(isRecord(value) && "source" in value ? ["source"] : []), ...(isRecord(value) && "layers" in value ? ["layers"] : []),
    ])) throw new Error("Living Atlas project has unknown fields.");
    if ("source" in value && value.source !== "imported") throw new Error("Living Atlas source is invalid.");
    if (value.schemaVersion !== LIVING_ATLAS_SCHEMA || value.grid !== "square") {
        throw new Error("Living Atlas project uses an unsupported schema or grid.");
    }

    const id = cleanText(value.id, 80);
    const name = cleanText(value.name, 80);
    if (!SAFE_ID.test(id) || !name) throw new Error("Living Atlas project needs a valid id and name.");
    const widthCells = parseInteger(value.widthCells, MIN_LIVING_ATLAS_CELLS, MAX_LIVING_ATLAS_CELLS, "Canvas width");
    const heightCells = parseInteger(value.heightCells, MIN_LIVING_ATLAS_CELLS, MAX_LIVING_ATLAS_CELLS, "Canvas height");
    if (!Array.isArray(value.shapes) || value.shapes.length > MAX_LIVING_ATLAS_SHAPES) {
        throw new Error(`Living Atlas project must contain no more than ${MAX_LIVING_ATLAS_SHAPES} shapes.`);
    }
    if (!Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.updatedAt)
        || (value.createdAt as number) < 0 || (value.updatedAt as number) < (value.createdAt as number)) {
        throw new Error("Living Atlas project has invalid timestamps.");
    }

    let layers: AtlasLayer[] | undefined;
    const layerIds = new Set<string>();
    if ("layers" in value) {
        if (!Array.isArray(value.layers) || !value.layers.length || value.layers.length > MAX_ATLAS_LAYERS) {
            throw new Error(`Living Atlas needs 1–${MAX_ATLAS_LAYERS} layers.`);
        }
        layers = value.layers.map((layer) => {
            if (!isRecord(layer) || !hasExactKeys(layer, ["id", "name", "visible", "locked"])
                || typeof layer.id !== "string" || !SAFE_ID.test(layer.id)
                || typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean") {
                throw new Error("Living Atlas layer has invalid or unknown fields.");
            }
            const name = cleanText(layer.name, 40);
            if (!name || layerIds.has(layer.id)) throw new Error("Living Atlas layer name or duplicate id is invalid.");
            layerIds.add(layer.id);
            return { id: layer.id, name, visible: layer.visible, locked: layer.locked };
        });
        if (!layerIds.has(BASE_ATLAS_LAYER_ID)) throw new Error("Living Atlas base layer is missing.");
    } else layerIds.add(BASE_ATLAS_LAYER_ID);

    const ids = new Set<string>();
    const shapes = value.shapes.map((shape) => {
        const parsed = parseShape(shape, widthCells, heightCells);
        if (!layerIds.has(shapeLayerId(parsed))) throw new Error("Living Atlas shape references a missing layer.");
        if (ids.has(parsed.id)) throw new Error("Living Atlas project contains duplicate shape ids.");
        ids.add(parsed.id);
        return parsed;
    });

    return {
        schemaVersion: LIVING_ATLAS_SCHEMA,
        id,
        name,
        widthCells,
        heightCells,
        grid: "square",
        shapes,
        ...(layers ? { layers } : {}),
        createdAt: value.createdAt as number,
        updatedAt: value.updatedAt as number,
        ...(value.source === "imported" ? { source: "imported" as const } : {}),
    };
}

export function serializeLivingAtlasDocument(document: LivingAtlasDocument): string {
    return JSON.stringify(readLivingAtlasDocument(JSON.stringify(document)), null, 2) + "\n";
}

export function safeLivingAtlasFileStem(name: string): string {
    const stem = cleanText(name, 80)
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/[. ]+$/g, "")
        .slice(0, 64);
    return stem || "living-atlas-map";
}
