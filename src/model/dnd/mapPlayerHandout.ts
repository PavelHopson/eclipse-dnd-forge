import type { LocationMapAsset, LocationMapGrid } from "./locationMap";
import type { MapStoryPin, MapStoryPinKind } from "./mapStoryPins";

export type MapPlayerHandoutPin = {
    x: number;
    y: number;
    label: string;
    kind: MapStoryPinKind;
};

export type MapPlayerHandoutPlan = {
    state: "ready";
    mapId: string;
    mapName: string;
    fileName: string;
    previewDataUrl: string;
    grid: LocationMapGrid;
    pins: MapPlayerHandoutPin[];
} | {
    state: "blocked";
    mapId: string;
    reason: "rights-review-required" | "rights-blocked";
};

function safeFileName(name: string): string {
    const base = name.normalize("NFKC")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    return `${base || "location-map"}-player.png`;
}

export function prepareMapPlayerHandout(
    map: LocationMapAsset,
    pins: MapStoryPin[],
): MapPlayerHandoutPlan {
    if (map.rightsState !== "allowed") {
        return {
            state: "blocked",
            mapId: map.id,
            reason: map.rightsState === "blocked" ? "rights-blocked" : "rights-review-required",
        };
    }

    return {
        state: "ready",
        mapId: map.id,
        mapName: map.name,
        fileName: safeFileName(map.name),
        previewDataUrl: map.previewDataUrl,
        grid: map.grid,
        pins: pins
            .filter((pin) => pin.mapId === map.id && pin.visibility === "table")
            .map((pin) => ({ x: pin.x, y: pin.y, label: pin.label, kind: pin.kind })),
    };
}
