import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("canvas tabs stay clear of campaign actions", async () => {
    const [view, styles] = await Promise.all([
        readFile(new URL("../src/view/VisualWritingInterface.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/index.css", import.meta.url), "utf8"),
    ]);

    assert.match(view, /className='dnd-canvas-tabs'/);
    assert.match(view, /className='dnd-quick-actions' role='toolbar' aria-label='Инструменты кампании'/);
    assert.match(styles, /\.dnd-canvas-tabs\s*\{[^}]*top:\s*10px;/s);
    assert.match(styles, /\.dnd-quick-actions\s*\{[^}]*top:\s*58px;/s);
    assert.match(styles, /:focus-visible\s*\{/);
});
