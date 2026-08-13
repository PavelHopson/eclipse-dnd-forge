import type { AzgaarExportSummary, AzgaarPlace } from "./azgaarImport.ts";
import { readAzgaarExport } from "./azgaarImport.ts";

export const CAMPAIGN_MAP_ASSET_SCHEMA = "eclipse.campaign-map-asset.v1" as const;
export const MAX_CAMPAIGN_MAP_ASSET_BYTES = 128 * 1024;

export type CampaignMapAsset = {
    schemaVersion: typeof CAMPAIGN_MAP_ASSET_SCHEMA;
    map: { name: string; source: "Azgaar"; sourceVersion: string | null };
    places: AzgaarPlace[];
};

export type MapImportResult = {
    inputKind: "azgaar" | "campaign-map-asset";
    summary: AzgaarExportSummary;
};

const MAX_PLACES = 60;
// eslint-disable-next-line no-control-regex -- imported labels must remove C0/C1 controls before preview
const MISLEADING_TEXT_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function cleanText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") return null;
    const clean = value
        .replace(MISLEADING_TEXT_CHARACTERS, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
        .trim();
    return clean || null;
}

export function buildCampaignMapAsset(summary: AzgaarExportSummary, places: AzgaarPlace[]): CampaignMapAsset {
    return {
        schemaVersion: CAMPAIGN_MAP_ASSET_SCHEMA,
        map: { name: summary.mapName, source: "Azgaar", sourceVersion: summary.version },
        places: places.slice(0, MAX_PLACES).map((place) => ({ ...place })),
    };
}

export function serializeCampaignMapAsset(asset: CampaignMapAsset): string {
    return JSON.stringify(asset, null, 2) + "\n";
}

export function readCampaignMapAsset(raw: string): AzgaarExportSummary {
    if (new TextEncoder().encode(raw).byteLength > MAX_CAMPAIGN_MAP_ASSET_BYTES) {
        throw new Error("Campaign Map Asset exceeds 128 KB.");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Campaign Map Asset contains invalid JSON.");
    }

    if (!isRecord(parsed) || !hasExactKeys(parsed, ["schemaVersion", "map", "places"])) {
        throw new Error("Campaign Map Asset has unknown fields or an incomplete structure.");
    }
    if (parsed.schemaVersion !== CAMPAIGN_MAP_ASSET_SCHEMA) {
        throw new Error("Expected schema " + CAMPAIGN_MAP_ASSET_SCHEMA + ".");
    }
    if (!isRecord(parsed.map) || !hasExactKeys(parsed.map, ["name", "source", "sourceVersion"])) {
        throw new Error("Campaign Map Asset has an invalid map block.");
    }
    if (parsed.map.source !== "Azgaar") {
        throw new Error("Campaign Map Asset supports only the verified Azgaar source.");
    }

    const mapName = cleanText(parsed.map.name, 80);
    const version = parsed.map.sourceVersion === null ? null : cleanText(parsed.map.sourceVersion, 24);
    if (!mapName || (parsed.map.sourceVersion !== null && !version)) {
        throw new Error("Campaign Map Asset has an invalid map name or source version.");
    }
    if (!Array.isArray(parsed.places) || parsed.places.length > MAX_PLACES) {
        throw new Error("Campaign Map Asset must contain no more than 60 places.");
    }

    const names = new Set<string>();
    const places = parsed.places.map((value, index): AzgaarPlace => {
        if (!isRecord(value) || !hasExactKeys(value, ["sourceId", "name", "population", "capital", "port", "fortified"])) {
            throw new Error("Place " + (index + 1) + " has unknown fields or incomplete data.");
        }
        const name = cleanText(value.name, 80);
        if (!name) throw new Error("Place " + (index + 1) + " has no valid name.");
        const nameKey = name.toLocaleLowerCase("ru");
        if (names.has(nameKey)) throw new Error("Place name is duplicated: " + name + ".");
        names.add(nameKey);

        if (!Number.isInteger(value.sourceId) || (value.sourceId as number) < 0) {
            throw new Error("Place has an invalid sourceId: " + name + ".");
        }
        if (typeof value.population !== "number" || !Number.isFinite(value.population) || value.population < 0) {
            throw new Error("Place has an invalid population: " + name + ".");
        }
        if (typeof value.capital !== "boolean" || typeof value.port !== "boolean" || typeof value.fortified !== "boolean") {
            throw new Error("Place has invalid flags: " + name + ".");
        }

        return {
            sourceId: value.sourceId as number,
            name,
            population: value.population,
            capital: value.capital,
            port: value.port,
            fortified: value.fortified,
        };
    });

    return {
        mapName,
        version,
        exportedAt: null,
        sourcePlaceCount: places.length,
        skippedPlaceCount: 0,
        places,
    };
}

export function readMapImport(raw: string): MapImportResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { inputKind: "azgaar", summary: readAzgaarExport(raw) };
    }
    if (isRecord(parsed) && typeof parsed.schemaVersion === "string") {
        return { inputKind: "campaign-map-asset", summary: readCampaignMapAsset(raw) };
    }
    return { inputKind: "azgaar", summary: readAzgaarExport(raw) };
}
