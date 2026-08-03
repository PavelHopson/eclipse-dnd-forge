import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("study messages do not render arbitrary HTML", async () => {
    const source = await readFile(new URL("../src/study/StudyMessage.tsx", import.meta.url), "utf8");

    assert.doesNotMatch(source, /dangerouslySetInnerHTML|\binnerHTML\s*=/);
    assert.match(source, /parsed\.protocol === "https:"/);
    assert.match(source, /rel="noopener noreferrer"/);
});
