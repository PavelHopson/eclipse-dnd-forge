import assert from "node:assert/strict";
import test from "node:test";
import { createLocationMapAsset } from "../src/model/dnd/locationMap.ts";
import { prepareMapPlayerHandout } from "../src/model/dnd/mapPlayerHandout.ts";
import { createMapStoryPin } from "../src/model/dnd/mapStoryPins.ts";

const PREVIEW = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlZsAAAAASUVORK5CYII=";

function provenance(overrides = {}) {
    return {
        rightsBasis: "original",
        creator: "Campaign author",
        provider: "",
        sourceUrl: null,
        license: "",
        attribution: "",
        commercialIntent: false,
        commercialRights: "not-requested",
        containsRealPerson: false,
        consentEvidence: "",
        ipRisk: "none",
        ...overrides,
    };
}

function map(provenanceOverrides = {}) {
    return createLocationMapAsset({
        id: "map-handout-1",
        locationId: "location-1",
        name: "Blackwater Ford / Player View",
        fileName: "blackwater.png",
        previewDataUrl: PREVIEW,
        grid: { type: "square", scale: 5, unit: "ft", widthCells: 30, heightCells: 20 },
        provenance: provenance(provenanceOverrides),
    }, 1_700_000_000_000);
}

function pin(id, visibility, label, note, mapId = "map-handout-1") {
    return createMapStoryPin({
        id,
        mapId,
        x: 2500,
        y: 5000,
        label,
        note,
        kind: "clue",
        visibility,
    }, 1_700_000_000_100);
}

test("player handout includes only table-safe marker fields", () => {
    const plan = prepareMapPlayerHandout(map(), [
        pin("pin-table-1", "table", "Open gate", "Player-safe note is not exported"),
        pin("pin-secret-1", "gm", "Hidden ambush", "GM-only secret"),
        pin("pin-other-map", "table", "Other map", "Should not cross maps", "map-other-1"),
    ]);

    assert.equal(plan.state, "ready");
    assert.deepEqual(plan.pins, [{ x: 2500, y: 5000, label: "Open gate", kind: "clue" }]);
    assert.equal(plan.fileName, "Blackwater-Ford-Player-View-player.png");
    assert.doesNotMatch(JSON.stringify(plan), /Hidden ambush|GM-only secret|Player-safe note|Other map/);
});

test("player handout export fails closed until map rights are allowed", () => {
    const review = map({
        rightsBasis: "external-tool",
        provider: "Example mapper",
        sourceUrl: "https://example.com/terms",
        license: "",
        attribution: "",
    });
    assert.deepEqual(prepareMapPlayerHandout(review, []), {
        state: "blocked",
        mapId: "map-handout-1",
        reason: "rights-review-required",
    });

    const blocked = map({ rightsBasis: "unverified" });
    assert.equal(prepareMapPlayerHandout(blocked, []).reason, "rights-blocked");
});
