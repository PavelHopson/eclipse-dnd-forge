import type { Location } from "../Model";

export const AZGAAR_MAP_URL = "https://azgaar.github.io/Fantasy-Map-Generator/";
export const MAX_AZGAAR_JSON_BYTES = 8 * 1024 * 1024;

export type AzgaarImportMode = "important" | "expanded";

export type AzgaarPlace = {
    sourceId: number;
    name: string;
    population: number;
    capital: boolean;
    port: boolean;
    fortified: boolean;
};

export type AzgaarExportSummary = {
    mapName: string;
    version: string | null;
    exportedAt: string | null;
    sourcePlaceCount: number;
    skippedPlaceCount: number;
    places: AzgaarPlace[];
};

export type AzgaarImportPlan = {
    selected: AzgaarPlace[];
    duplicates: AzgaarPlace[];
    availableCount: number;
    limit: number;
};

const IMPORTANT_PLACE_LIMIT = 24;
const EXPANDED_PLACE_LIMIT = 60;
// eslint-disable-next-line no-control-regex -- imported labels must remove C0/C1 controls before preview
const MISLEADING_TEXT_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback = 0): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") return null;

    // Control and bidi override characters make file previews misleading. They are
    // not useful in map names, so remove them before rendering or de-duplicating.
    const clean = value
        .replace(MISLEADING_TEXT_CHARACTERS, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
        .trim();

    return clean || null;
}

function placePriority(place: AzgaarPlace): number {
    return (place.capital ? 1_000_000_000 : 0)
        + (place.fortified ? 100_000_000 : 0)
        + (place.port ? 10_000_000 : 0)
        + Math.max(0, place.population);
}

export function readAzgaarExport(raw: string): AzgaarExportSummary {
    if (new TextEncoder().encode(raw).byteLength > MAX_AZGAAR_JSON_BYTES) {
        throw new Error("Файл больше 8 МБ. В Azgaar выберите Export → JSON → Minimal.");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Это невалидный JSON. Экспортируйте карту через Export → JSON → Minimal.");
    }

    if (!isRecord(parsed) || !isRecord(parsed.pack) || !Array.isArray(parsed.pack.burgs)) {
        throw new Error("Не найден официальный список pack.burgs. Нужен Full или Minimal JSON из Azgaar.");
    }

    const info = isRecord(parsed.info) ? parsed.info : {};
    const settings = isRecord(parsed.settings) ? parsed.settings : {};
    const mapName = cleanText(info.mapName, 80)
        ?? cleanText(settings.mapName, 80)
        ?? "Карта без названия";
    const version = cleanText(info.version, 24);
    const exportedAt = cleanText(info.exportedAt, 40);
    const placesByName = new Map<string, AzgaarPlace>();

    parsed.pack.burgs.forEach((value) => {
        if (!isRecord(value) || value.removed === true) return;
        const name = cleanText(value.name, 80);
        const sourceId = finiteNumber(value.i, -1);
        const x = finiteNumber(value.x, Number.NaN);
        const y = finiteNumber(value.y, Number.NaN);
        if (!name || sourceId < 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;

        const key = name.toLocaleLowerCase("ru");
        const next: AzgaarPlace = {
            sourceId,
            name,
            population: Math.max(0, finiteNumber(value.population)),
            capital: finiteNumber(value.capital) > 0,
            port: finiteNumber(value.port) > 0,
            fortified: finiteNumber(value.citadel) > 0 || finiteNumber(value.walls) > 0,
        };
        const previous = placesByName.get(key);
        if (!previous || placePriority(next) > placePriority(previous)) placesByName.set(key, next);
    });

    const places = [...placesByName.values()].sort((a, b) => {
        const priority = placePriority(b) - placePriority(a);
        return priority || a.name.localeCompare(b.name, "ru");
    });

    return {
        mapName,
        version,
        exportedAt,
        sourcePlaceCount: parsed.pack.burgs.length,
        skippedPlaceCount: Math.max(0, parsed.pack.burgs.length - places.length),
        places,
    };
}

export function planAzgaarImport(
    summary: AzgaarExportSummary,
    existingLocationNames: string[],
    mode: AzgaarImportMode,
): AzgaarImportPlan {
    const existing = new Set(
        existingLocationNames
            .map((name) => cleanText(name, 80)?.toLocaleLowerCase("ru"))
            .filter((name): name is string => Boolean(name)),
    );
    const duplicates = summary.places.filter((place) => existing.has(place.name.toLocaleLowerCase("ru")));
    const available = summary.places.filter((place) => !existing.has(place.name.toLocaleLowerCase("ru")));
    const limit = mode === "important" ? IMPORTANT_PLACE_LIMIT : EXPANDED_PLACE_LIMIT;

    return {
        selected: available.slice(0, limit),
        duplicates,
        availableCount: available.length,
        limit,
    };
}

export function azgaarPlaceToLocation(place: AzgaarPlace): Location {
    const kind = place.fortified ? "stronghold" : "town";
    const biome = place.capital
        ? "столица"
        : place.port
            ? "порт"
            : place.fortified
                ? "укреплённый город"
                : "поселение";

    return {
        name: place.name,
        emoji: place.capital ? "🏛️" : place.port ? "⚓" : place.fortified ? "🏰" : "🏘️",
        kind,
        biome,
    };
}

export function buildAzgaarCampaignBrief(
    campaignText: string,
    locations: Location[],
): string {
    const firstLine = cleanText(campaignText.split(/\r?\n/).find((line) => line.trim()), 100)
        ?? "Новая D&D-кампания";
    const knownLocations = locations.slice(0, 24).map((location) => {
        const details = [location.kind, location.biome, location.danger ? `опасность ${location.danger}/10` : null]
            .filter(Boolean)
            .join(", ");
        return `- ${cleanText(location.name, 80) ?? "Без названия"}${details ? ` — ${details}` : ""}`;
    });

    return [
        `Кампания: ${firstLine}`,
        "",
        "Обязательные места на карте:",
        knownLocations.length ? knownLocations.join("\n") : "- Пока нет: сначала создайте основные локации кампании.",
        "",
        "Что подготовить в Azgaar:",
        "- выбрать масштаб: мир, континент или регион;",
        "- сохранить узнаваемые государства, дороги, реки и границы;",
        "- проверить, что ключевые места подписаны без спойлеров для игроков;",
        "- сохранить рабочий .map-файл на компьютер;",
        "- для Eclipse DnD Forge экспортировать Export → JSON → Minimal.",
    ].join("\n");
}
