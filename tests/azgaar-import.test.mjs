import assert from "node:assert/strict";
import test from "node:test";
import {
    MAX_AZGAAR_JSON_BYTES,
    azgaarPlaceToLocation,
    buildAzgaarCampaignBrief,
    planAzgaarImport,
    readAzgaarExport,
} from "../src/model/dnd/azgaarImport.ts";

function exportFixture(burgs) {
    return JSON.stringify({
        info: { mapName: "The Shattered Realm", version: "1.139.7" },
        pack: { burgs },
    });
}

test("parses official burg exports and removes misleading control characters", () => {
    const summary = readAzgaarExport(exportFixture([
        { i: 0 },
        { i: 1, x: 10, y: 20, name: "Highcourt", capital: 1, population: 120 },
        { i: 2, x: 30, y: 40, name: "Port Azure", port: 1, population: 80 },
        { i: 3, x: 50, y: 60, name: "Highcourt", population: 1 },
        { i: 4, x: 70, y: 80, name: "Fort\u202eGate", walls: 1 },
        { i: 5, x: Number.NaN, y: 90, name: "Broken" },
    ]));

    assert.equal(summary.mapName, "The Shattered Realm");
    assert.equal(summary.places.length, 3);
    assert.equal(summary.places.some((place) => place.name.includes("\u202e")), false);
    assert.equal(summary.skippedPlaceCount, 3);
});

test("plans a bounded, duplicate-safe import and makes repeat import idempotent", () => {
    const burgs = Array.from({ length: 65 }, (_, index) => ({
        i: index + 1,
        x: index * 2,
        y: index * 3,
        name: `Place ${index + 1}`,
        population: index,
        capital: index === 0 ? 1 : 0,
    }));
    const summary = readAzgaarExport(exportFixture(burgs));

    const important = planAzgaarImport(summary, ["Place 2"], "important");
    assert.equal(important.selected.length, 24);
    assert.equal(important.duplicates.length, 1);

    const expanded = planAzgaarImport(summary, [], "expanded");
    assert.equal(expanded.selected.length, 60);

    const repeated = planAzgaarImport(summary, summary.places.map((place) => place.name), "expanded");
    assert.equal(repeated.selected.length, 0);
    assert.equal(repeated.duplicates.length, 65);
});

test("fails closed for malformed, oversized and unrelated JSON", () => {
    assert.throws(() => readAzgaarExport("{"), /невалидный JSON/);
    assert.throws(() => readAzgaarExport("{}"), /pack\.burgs/);
    assert.throws(
        () => readAzgaarExport(" ".repeat(MAX_AZGAAR_JSON_BYTES + 1)),
        /больше 8 МБ/,
    );
});

test("maps only explicit Azgaar facts and builds a useful campaign brief", () => {
    const location = azgaarPlaceToLocation({
        sourceId: 7,
        name: "Stonewatch",
        population: 20,
        capital: false,
        port: false,
        fortified: true,
    });

    assert.deepEqual(location, {
        name: "Stonewatch",
        emoji: "🏰",
        kind: "stronghold",
        biome: "укреплённый город",
    });
    assert.match(buildAzgaarCampaignBrief("Session One", [location]), /Stonewatch/);
    assert.match(buildAzgaarCampaignBrief("Session One", [location]), /JSON → Minimal/);
});
