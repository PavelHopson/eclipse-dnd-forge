export const REFERENCE_BOARD_SCHEMA = "eclipse.reference-board.v1" as const;
export const MAX_REFERENCE_ASSETS = 24;
export const MAX_REFERENCE_PREVIEW_BYTES = 256 * 1024;
export const MAX_REFERENCE_BOARD_BYTES = 2 * 1024 * 1024;

export const REFERENCE_ASSET_KINDS = [
    "character",
    "creature",
    "location",
    "object",
    "pose",
    "shot",
] as const;
export type ReferenceAssetKind = typeof REFERENCE_ASSET_KINDS[number];

export const REFERENCE_ASSET_STATUSES = ["draft", "review", "approved", "blocked"] as const;
export type ReferenceAssetStatus = typeof REFERENCE_ASSET_STATUSES[number];

export const REFERENCE_PROVENANCE_KINDS = [
    "original",
    "commissioned",
    "licensed",
    "public-domain",
    "generated",
] as const;
export type ReferenceProvenanceKind = typeof REFERENCE_PROVENANCE_KINDS[number];
export type ReferenceProvenanceStatus = "complete" | "review" | "blocked";

export type ReferenceProjectBible = {
    title: string;
    visualDirection: string;
    palette: string[];
    cameraLanguage: string;
    continuityRules: string[];
    avoid: string[];
    updatedAt: number;
};

export type ReferenceProvenance = {
    kind: ReferenceProvenanceKind;
    creator: string;
    sourceUrl: string | null;
    license: string;
    containsRealPerson: boolean;
    consentEvidence: string;
};

export type ReferenceAsset = {
    id: string;
    kind: ReferenceAssetKind;
    name: string;
    summary: string;
    stableTraits: string[];
    previewDataUrl: string | null;
    provenance: ReferenceProvenance;
    status: ReferenceAssetStatus;
    createdAt: number;
    updatedAt: number;
};

export type ReferenceBoard = {
    schemaVersion: typeof REFERENCE_BOARD_SCHEMA;
    bible: ReferenceProjectBible;
    assets: ReferenceAsset[];
};

const DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function stripUnsafeCharacters(value: string): string {
    return Array.from(value, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        const isControl = codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
        const isBidiOverride = (codePoint >= 0x202a && codePoint <= 0x202e)
            || (codePoint >= 0x2066 && codePoint <= 0x2069);
        return isControl || isBidiOverride ? " " : character;
    }).join("");
}

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
    return stripUnsafeCharacters(value).replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function cleanLines(value: unknown, maxItems: number, maxLength: number): string[] {
    if (!Array.isArray(value)) return [];
    const unique = new Set<string>();
    for (const item of value) {
        const clean = cleanText(item, maxLength);
        if (clean) unique.add(clean);
        if (unique.size >= maxItems) break;
    }
    return [...unique];
}

function cleanHttpsUrl(value: unknown): string | null {
    const clean = cleanText(value, 500);
    if (!clean) return null;
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

function parsePreviewDataUrl(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== "string") throw new Error("Reference preview must be a data URL or null.");
    const match = DATA_URL.exec(value);
    if (!match || previewBytes(value) > MAX_REFERENCE_PREVIEW_BYTES) {
        throw new Error("Reference preview exceeds 256 KB or uses an unsupported format.");
    }
    let bytes: number[];
    try {
        bytes = Array.from(atob(match[2].slice(0, 24)), (character) => character.charCodeAt(0));
    } catch {
        throw new Error("Reference preview contains invalid base64.");
    }
    const mime = match[1];
    const validPng = mime === "png" && bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    const validJpeg = mime === "jpeg" && bytes.length >= 3
        && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const validWebp = mime === "webp" && bytes.length >= 12
        && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
        && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!validPng && !validJpeg && !validWebp) {
        throw new Error("Reference preview content does not match its declared image format.");
    }
    return value;
}

export function emptyReferenceBoard(now = Date.now()): ReferenceBoard {
    return {
        schemaVersion: REFERENCE_BOARD_SCHEMA,
        bible: {
            title: "",
            visualDirection: "",
            palette: [],
            cameraLanguage: "",
            continuityRules: [],
            avoid: [],
            updatedAt: now,
        },
        assets: [],
    };
}

export function provenanceStatus(provenance: ReferenceProvenance): ReferenceProvenanceStatus {
    if (provenance.containsRealPerson && provenance.consentEvidence.length < 12) return "blocked";
    if (!provenance.creator) return "review";
    if ((provenance.kind === "licensed" || provenance.kind === "public-domain") &&
        (!provenance.sourceUrl || !provenance.license)) return "review";
    if (provenance.kind === "commissioned" && !provenance.license) return "review";
    return "complete";
}

export function readReferenceBoard(raw: string): ReferenceBoard {
    if (new TextEncoder().encode(raw).byteLength > MAX_REFERENCE_BOARD_BYTES) {
        throw new Error("Reference Board exceeds 2 MB.");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Reference Board contains invalid JSON.");
    }
    if (!isRecord(parsed) || !hasExactKeys(parsed, ["schemaVersion", "bible", "assets"]) ||
        parsed.schemaVersion !== REFERENCE_BOARD_SCHEMA) {
        throw new Error("Reference Board has unknown fields or an unsupported schema.");
    }
    if (!isRecord(parsed.bible) || !hasExactKeys(parsed.bible, [
        "title", "visualDirection", "palette", "cameraLanguage", "continuityRules", "avoid", "updatedAt",
    ])) {
        throw new Error("Reference Board has an invalid project bible.");
    }

    const bible: ReferenceProjectBible = {
        title: cleanText(parsed.bible.title, 80),
        visualDirection: cleanText(parsed.bible.visualDirection, 500),
        palette: cleanLines(parsed.bible.palette, 8, 24),
        cameraLanguage: cleanText(parsed.bible.cameraLanguage, 300),
        continuityRules: cleanLines(parsed.bible.continuityRules, 12, 120),
        avoid: cleanLines(parsed.bible.avoid, 12, 120),
        updatedAt: Number.isSafeInteger(parsed.bible.updatedAt) && (parsed.bible.updatedAt as number) >= 0
            ? parsed.bible.updatedAt as number
            : 0,
    };
    if (!Array.isArray(parsed.assets) || parsed.assets.length > MAX_REFERENCE_ASSETS) {
        throw new Error("Reference Board must contain no more than 24 assets.");
    }

    const ids = new Set<string>();
    let totalPreviewBytes = 0;
    const assets = parsed.assets.map((value, index): ReferenceAsset => {
        if (!isRecord(value) || !hasExactKeys(value, [
            "id", "kind", "name", "summary", "stableTraits", "previewDataUrl", "provenance", "status", "createdAt", "updatedAt",
        ])) throw new Error(`Reference asset ${index + 1} has unknown fields.`);
        const id = cleanText(value.id, 80);
        if (!/^[a-z0-9][a-z0-9-]{5,79}$/.test(id) || ids.has(id)) throw new Error("Reference asset has an invalid or duplicate id.");
        ids.add(id);
        if (!REFERENCE_ASSET_KINDS.includes(value.kind as ReferenceAssetKind)) throw new Error("Reference asset has an invalid kind.");
        if (!REFERENCE_ASSET_STATUSES.includes(value.status as ReferenceAssetStatus)) throw new Error("Reference asset has an invalid status.");
        const name = cleanText(value.name, 80);
        if (!name) throw new Error("Reference asset name is required.");
        const previewDataUrl = parsePreviewDataUrl(value.previewDataUrl);
        if (previewDataUrl) {
            const bytes = previewBytes(previewDataUrl);
            totalPreviewBytes += bytes;
        }
        if (!isRecord(value.provenance) || !hasExactKeys(value.provenance, [
            "kind", "creator", "sourceUrl", "license", "containsRealPerson", "consentEvidence",
        ]) || !REFERENCE_PROVENANCE_KINDS.includes(value.provenance.kind as ReferenceProvenanceKind)) {
            throw new Error("Reference asset has invalid provenance.");
        }
        if (typeof value.provenance.containsRealPerson !== "boolean") throw new Error("Reference asset has invalid person consent state.");
        const sourceUrl = value.provenance.sourceUrl === null ? null : cleanHttpsUrl(value.provenance.sourceUrl);
        if (value.provenance.sourceUrl !== null && !sourceUrl) throw new Error("Provenance source must use HTTPS without embedded credentials.");
        const provenance: ReferenceProvenance = {
            kind: value.provenance.kind as ReferenceProvenanceKind,
            creator: cleanText(value.provenance.creator, 100),
            sourceUrl,
            license: cleanText(value.provenance.license, 120),
            containsRealPerson: value.provenance.containsRealPerson,
            consentEvidence: cleanText(value.provenance.consentEvidence, 300),
        };
        if (value.status === "approved" && provenanceStatus(provenance) !== "complete") {
            throw new Error("An approved reference must have complete provenance and consent.");
        }
        return {
            id,
            kind: value.kind as ReferenceAssetKind,
            name,
            summary: cleanText(value.summary, 500),
            stableTraits: cleanLines(value.stableTraits, 8, 80),
            previewDataUrl,
            provenance,
            status: value.status as ReferenceAssetStatus,
            createdAt: Number.isSafeInteger(value.createdAt) && (value.createdAt as number) >= 0 ? value.createdAt as number : 0,
            updatedAt: Number.isSafeInteger(value.updatedAt) && (value.updatedAt as number) >= 0 ? value.updatedAt as number : 0,
        };
    });
    if (totalPreviewBytes > MAX_REFERENCE_BOARD_BYTES) throw new Error("Reference previews exceed the board storage budget.");
    return { schemaVersion: REFERENCE_BOARD_SCHEMA, bible, assets };
}

export function serializeReferenceBoard(board: ReferenceBoard): string {
    return JSON.stringify(readReferenceBoard(JSON.stringify(board)), null, 2) + "\n";
}
