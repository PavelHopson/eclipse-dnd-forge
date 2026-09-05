import { readLivingAtlasDocument, type LivingAtlasDocument } from "./livingAtlas.ts";

export const LOCATION_MAP_LIBRARY_SCHEMA = "eclipse.location-map-library.v1" as const;
export const MAX_LOCATION_MAPS = 8;
export const MAX_LOCATION_MAP_SOURCE_BYTES = 8 * 1024 * 1024;
export const MAX_LOCATION_MAP_PREVIEW_BYTES = 384 * 1024;
export const MAX_LOCATION_MAP_LIBRARY_BYTES = 4 * 1024 * 1024;

export const LOCATION_MAP_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LocationMapImageType = typeof LOCATION_MAP_IMAGE_TYPES[number];
export type LocationMapGridType = "none" | "square" | "hex";
export type LocationMapScaleUnit = "ft" | "m" | "km" | "mi" | "custom";
export type LocationMapRightsBasis =
    | "original"
    | "licensed"
    | "public-domain"
    | "generated"
    | "external-tool"
    | "unverified";
export type LocationMapCommercialRights = "not-requested" | "confirmed" | "unknown" | "prohibited";
export type LocationMapIpRisk = "none" | "review" | "blocked";
export type LocationMapGateState = "allowed" | "review-required" | "blocked";
export type LocationMapGateReason =
    | "source-rights-unverified"
    | "creator-missing"
    | "provider-missing"
    | "source-record-missing"
    | "license-missing"
    | "attribution-missing"
    | "commercial-rights-unverified"
    | "commercial-use-prohibited"
    | "real-person-consent-missing"
    | "derivative-risk-review"
    | "derivative-risk-blocked";

export type LocationMapGrid = {
    type: LocationMapGridType;
    scale: number;
    unit: LocationMapScaleUnit;
    widthCells: number;
    heightCells: number;
};

export type LocationMapProvenance = {
    rightsBasis: LocationMapRightsBasis;
    creator: string;
    provider: string;
    sourceUrl: string | null;
    license: string;
    attribution: string;
    commercialIntent: boolean;
    commercialRights: LocationMapCommercialRights;
    containsRealPerson: boolean;
    consentEvidence: string;
    ipRisk: LocationMapIpRisk;
};

export type LocationMapAsset = {
    id: string;
    locationId: string;
    name: string;
    fileName: string;
    previewDataUrl: string;
    grid: LocationMapGrid;
    provenance: LocationMapProvenance;
    rightsState: LocationMapGateState;
    createdAt: number;
    updatedAt: number;
    atlasDocument?: LivingAtlasDocument;
};

export type LocationMapLibrary = {
    schemaVersion: typeof LOCATION_MAP_LIBRARY_SCHEMA;
    maps: LocationMapAsset[];
};

export type LocationMapGateDecision = {
    state: LocationMapGateState;
    reasons: LocationMapGateReason[];
};

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{2,79}$/;

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

function cleanHttpsUrl(value: unknown): string | null {
    if (value === null || value === "") return null;
    const clean = cleanText(value, 2048);
    try {
        const url = new URL(clean);
        if (url.protocol !== "https:" || url.username || url.password) return null;
        return url.toString();
    } catch {
        return null;
    }
}

function previewBytes(value: string): number {
    const match = DATA_URL.exec(value);
    if (!match) return Number.POSITIVE_INFINITY;
    const payload = match[2];
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.floor(payload.length * 3 / 4) - padding;
}

function hasImageSignature(mime: LocationMapImageType, bytes: Uint8Array): boolean {
    if (mime === "image/png") {
        return bytes.length >= 8
            && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
            && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    }
    if (mime === "image/jpeg") {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    return bytes.length >= 12
        && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
        && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function validateLocationMapSourceHeader(mime: string, bytes: Uint8Array): LocationMapImageType {
    if (!LOCATION_MAP_IMAGE_TYPES.includes(mime as LocationMapImageType)) {
        throw new Error("Поддерживаются только PNG, JPEG и WebP. SVG и другие активные форматы запрещены.");
    }
    const imageType = mime as LocationMapImageType;
    if (!hasImageSignature(imageType, bytes)) {
        throw new Error("Содержимое изображения не соответствует заявленному формату.");
    }
    return imageType;
}

export function validateLocationMapPreviewDataUrl(value: unknown): string {
    if (typeof value !== "string") throw new Error("Map preview must be a data URL.");
    const match = DATA_URL.exec(value);
    if (!match || previewBytes(value) > MAX_LOCATION_MAP_PREVIEW_BYTES) {
        throw new Error("Map preview exceeds 384 KB or uses an unsupported format.");
    }
    let bytes: Uint8Array;
    try {
        bytes = Uint8Array.from(atob(match[2].slice(0, 32)), (character) => character.charCodeAt(0));
    } catch {
        throw new Error("Map preview contains invalid base64.");
    }
    validateLocationMapSourceHeader(`image/${match[1]}`, bytes);
    return value;
}

export function evaluateLocationMapRights(provenance: LocationMapProvenance): LocationMapGateDecision {
    const review = new Set<LocationMapGateReason>();
    const blocked = new Set<LocationMapGateReason>();

    if (provenance.rightsBasis === "unverified") blocked.add("source-rights-unverified");
    if (!provenance.creator) review.add("creator-missing");

    const requiresSourceRecord = provenance.rightsBasis === "licensed"
        || provenance.rightsBasis === "public-domain"
        || provenance.rightsBasis === "generated"
        || provenance.rightsBasis === "external-tool";
    if (requiresSourceRecord && !provenance.sourceUrl) review.add("source-record-missing");
    if (requiresSourceRecord && !provenance.license) review.add("license-missing");
    if (requiresSourceRecord && !provenance.attribution) review.add("attribution-missing");
    if ((provenance.rightsBasis === "generated" || provenance.rightsBasis === "external-tool") && !provenance.provider) {
        review.add("provider-missing");
    }

    if (provenance.commercialIntent) {
        if (provenance.commercialRights === "prohibited") blocked.add("commercial-use-prohibited");
        if (provenance.commercialRights !== "confirmed" && provenance.commercialRights !== "prohibited") {
            review.add("commercial-rights-unverified");
        }
    }

    if (provenance.containsRealPerson && provenance.consentEvidence.length < 12) {
        blocked.add("real-person-consent-missing");
    }
    if (provenance.ipRisk === "review") review.add("derivative-risk-review");
    if (provenance.ipRisk === "blocked") blocked.add("derivative-risk-blocked");

    if (blocked.size > 0) return { state: "blocked", reasons: [...blocked, ...review] };
    if (review.size > 0) return { state: "review-required", reasons: [...review] };
    return { state: "allowed", reasons: [] };
}

export function emptyLocationMapLibrary(): LocationMapLibrary {
    return { schemaVersion: LOCATION_MAP_LIBRARY_SCHEMA, maps: [] };
}

function parseGrid(value: unknown): LocationMapGrid {
    if (!isRecord(value) || !hasExactKeys(value, ["type", "scale", "unit", "widthCells", "heightCells"])) {
        throw new Error("Location map has an invalid grid block.");
    }
    if (!["none", "square", "hex"].includes(String(value.type))) throw new Error("Location map has an invalid grid type.");
    if (!["ft", "m", "km", "mi", "custom"].includes(String(value.unit))) throw new Error("Location map has an invalid scale unit.");
    if (typeof value.scale !== "number" || !Number.isFinite(value.scale) || value.scale <= 0 || value.scale > 10000) {
        throw new Error("Location map scale must be between 0 and 10000.");
    }
    if (!Number.isInteger(value.widthCells) || !Number.isInteger(value.heightCells)
        || (value.widthCells as number) < 1 || (value.widthCells as number) > 500
        || (value.heightCells as number) < 1 || (value.heightCells as number) > 500) {
        throw new Error("Location map dimensions must be between 1 and 500 cells.");
    }
    return {
        type: value.type as LocationMapGridType,
        scale: value.scale,
        unit: value.unit as LocationMapScaleUnit,
        widthCells: value.widthCells as number,
        heightCells: value.heightCells as number,
    };
}

function parseProvenance(value: unknown): LocationMapProvenance {
    if (!isRecord(value) || !hasExactKeys(value, [
        "rightsBasis", "creator", "provider", "sourceUrl", "license", "attribution", "commercialIntent",
        "commercialRights", "containsRealPerson", "consentEvidence", "ipRisk",
    ])) throw new Error("Location map has invalid provenance.");
    if (!["original", "licensed", "public-domain", "generated", "external-tool", "unverified"].includes(String(value.rightsBasis))) {
        throw new Error("Location map has an invalid rights basis.");
    }
    if (!["not-requested", "confirmed", "unknown", "prohibited"].includes(String(value.commercialRights))) {
        throw new Error("Location map has an invalid commercial-rights state.");
    }
    if (!["none", "review", "blocked"].includes(String(value.ipRisk))) throw new Error("Location map has an invalid IP-risk state.");
    if (typeof value.commercialIntent !== "boolean" || typeof value.containsRealPerson !== "boolean") {
        throw new Error("Location map provenance has invalid flags.");
    }
    const sourceUrl = cleanHttpsUrl(value.sourceUrl);
    if (value.sourceUrl !== null && value.sourceUrl !== "" && !sourceUrl) {
        throw new Error("Map source URL must use HTTPS without embedded credentials.");
    }
    return {
        rightsBasis: value.rightsBasis as LocationMapRightsBasis,
        creator: cleanText(value.creator, 100),
        provider: cleanText(value.provider, 100),
        sourceUrl,
        license: cleanText(value.license, 160),
        attribution: cleanText(value.attribution, 300),
        commercialIntent: value.commercialIntent,
        commercialRights: value.commercialRights as LocationMapCommercialRights,
        containsRealPerson: value.containsRealPerson,
        consentEvidence: cleanText(value.consentEvidence, 300),
        ipRisk: value.ipRisk as LocationMapIpRisk,
    };
}

function parseAsset(value: unknown, index: number): LocationMapAsset {
    if (!isRecord(value) || !hasExactKeys(value, [
        "id", "locationId", "name", "fileName", "previewDataUrl", "grid", "provenance", "rightsState", "createdAt", "updatedAt", ...(isRecord(value) && "atlasDocument" in value ? ["atlasDocument"] : []),
    ])) throw new Error(`Location map ${index + 1} has unknown fields.`);
    const id = cleanText(value.id, 80);
    const locationId = cleanText(value.locationId, 80);
    const name = cleanText(value.name, 80);
    const fileName = cleanText(value.fileName, 120);
    if (!SAFE_ID.test(id) || !SAFE_ID.test(locationId)) throw new Error("Location map has an invalid id or locationId.");
    if (!name || !fileName) throw new Error("Location map name and source filename are required.");
    const provenance = parseProvenance(value.provenance);
    const decision = evaluateLocationMapRights(provenance);
    if (value.rightsState !== decision.state) throw new Error("Location map rights state does not match its provenance.");
    const grid = parseGrid(value.grid);
    const atlasDocument = "atlasDocument" in value ? readLivingAtlasDocument(JSON.stringify(value.atlasDocument)) : undefined;
    if (atlasDocument && (grid.type !== "square" || grid.widthCells !== atlasDocument.widthCells || grid.heightCells !== atlasDocument.heightCells)) {
        throw new Error("Editable map dimensions must match its preview grid.");
    }
    if (!Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.updatedAt)
        || (value.createdAt as number) < 0 || (value.updatedAt as number) < (value.createdAt as number)) {
        throw new Error("Location map has invalid timestamps.");
    }
    return {
        id,
        locationId,
        name,
        fileName,
        previewDataUrl: validateLocationMapPreviewDataUrl(value.previewDataUrl),
        grid,
        ...(atlasDocument ? { atlasDocument } : {}),
        provenance,
        rightsState: decision.state,
        createdAt: value.createdAt as number,
        updatedAt: value.updatedAt as number,
    };
}

export function readLocationMapLibrary(raw: string): LocationMapLibrary {
    if (new TextEncoder().encode(raw).byteLength > MAX_LOCATION_MAP_LIBRARY_BYTES) {
        throw new Error("Location Map Library exceeds 4 MB.");
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Location Map Library contains invalid JSON.");
    }
    if (!isRecord(parsed) || !hasExactKeys(parsed, ["schemaVersion", "maps"])
        || parsed.schemaVersion !== LOCATION_MAP_LIBRARY_SCHEMA || !Array.isArray(parsed.maps)) {
        throw new Error("Location Map Library has unknown fields or an unsupported schema.");
    }
    if (parsed.maps.length > MAX_LOCATION_MAPS) throw new Error("Location Map Library must contain no more than 8 maps.");
    const ids = new Set<string>();
    const maps = parsed.maps.map((value, index) => {
        const map = parseAsset(value, index);
        if (ids.has(map.id)) throw new Error("Location Map Library contains a duplicate map id.");
        ids.add(map.id);
        return map;
    });
    return { schemaVersion: LOCATION_MAP_LIBRARY_SCHEMA, maps };
}

export function createLocationMapAsset(
    input: Omit<LocationMapAsset, "rightsState" | "createdAt" | "updatedAt">,
    now = Date.now(),
): LocationMapAsset {
    const candidate = {
        ...input,
        rightsState: evaluateLocationMapRights(input.provenance).state,
        createdAt: now,
        updatedAt: now,
    };
    return readLocationMapLibrary(JSON.stringify({
        schemaVersion: LOCATION_MAP_LIBRARY_SCHEMA,
        maps: [candidate],
    })).maps[0];
}

export function serializeLocationMapLibrary(library: LocationMapLibrary): string {
    return JSON.stringify(readLocationMapLibrary(JSON.stringify(library)), null, 2) + "\n";
}
