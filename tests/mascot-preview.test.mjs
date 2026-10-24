import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../src/view/dnd/MascotPreview.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/view/dnd/MascotPreview.css", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const familiar = await readFile(new URL("../src/view/dnd/WelcomeFamiliar.tsx", import.meta.url), "utf8");

test("mascot preview is a local, text-led state review", () => {
    assert.match(app, /path: ['"]mascots-preview['"]/);
    assert.match(component, /LicenseRef-Eclipse-Internal-Review/);
    assert.match(component, /kverk-v0\.1\.0/);
    assert.match(component, /aria-pressed/);
    assert.match(component, /alt=""/);
    assert.match(component, /aria-hidden="true"/);
    assert.match(component, /onError=/);
    assert.match(component, /Кверк остаётся доступен как текстовый статус/);
    assert.match(familiar, /href="#\/mascots-directions"/);
});

test("mascot preview covers all contract states and responsive safety", () => {
    for (const state of ["idle", "greet", "curious", "delight", "rest"]) assert.match(component, new RegExp(`id: "${state}"`));
    assert.match(component, /<ul className="mascot-preview__state-list"/);
    assert.match(component, /<li key={item\.id}>/);
    assert.match(component, /aria-label="Состояния Кверка"/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /max-width: 760px/);
    assert.match(css, /min-height: 48px/);
    assert.doesNotMatch(css, /animation:\s*[^;]*infinite/);
});
