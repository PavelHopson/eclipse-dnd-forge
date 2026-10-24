import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/view/dnd/MascotDirectionBoard.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/view/dnd/MascotDirectionBoard.css", import.meta.url), "utf8");
const alternative = await readFile(new URL("../public/mascots/kverk-v0.1.0/alternative.svg", import.meta.url), "utf8");

test("DnD mascot board is an explicit candidate direction review", () => {
    assert.match(component, /IDEA-028-DND/);
    assert.match(component, /Гранёный ворон/);
    assert.match(component, /Оригинальный фамильяр/);
    assert.match(component, /working-vector-sketch/);
    assert.match(component, /LicenseRef-Eclipse-Internal-Review/);
    assert.match(component, /без Koboyo/);
    assert.match(component, /aria-pressed/);
    assert.match(component, /onError=/);
    assert.match(component, /Выбор меняет только локальный preview/);
});

test("direction board remains keyboard/mobile/reduced-motion safe", () => {
    assert.match(css, /:focus-visible/);
    assert.match(css, /min-height: 52px/);
    assert.match(css, /max-width: 760px/);
    assert.match(css, /prefers-reduced-motion/);
    assert.doesNotMatch(css, /animation:\s*[^;]*infinite/);
});

test("alternative asset is local static SVG with stable geometry", () => {
    assert.match(alternative, /viewBox="0 0 256 256"/);
    assert.doesNotMatch(alternative, /<(?:script|foreignObject|image|animate|set)\b|href=|\bon\w+=|url\(/i);
    assert.ok(Buffer.byteLength(alternative) < 4096);
});
