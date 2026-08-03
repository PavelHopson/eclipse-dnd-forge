import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("study messages do not render arbitrary HTML", async () => {
    const source = await readFile(new URL("../src/study/StudyMessage.tsx", import.meta.url), "utf8");

    assert.doesNotMatch(source, /dangerouslySetInnerHTML|\binnerHTML\s*=/);
    assert.match(source, /parsed\.protocol === "https:"/);
    assert.match(source, /rel="noopener noreferrer"/);
});

test("cloud keys are not bundled from env or carried in the campaign URL", async () => {
    const [launcher, model, store] = await Promise.all([
        readFile(new URL("../src/view/Launcher.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/model/Model.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/store/useAiConfigStore.ts", import.meta.url), "utf8"),
    ]);

    assert.doesNotMatch(launcher, /btoa\(|\?k=/);
    assert.doesNotMatch(model, /VITE_OPENAI_API_KEY|atob\(|location\.hash/);
    assert.match(launcher, /window\.location\.hash = '\/free-form';/);
    assert.match(store, /persistSessionCredentials/);
    assert.match(store, /clearSessionCredentials/);

    const persistentSnapshot = store.slice(
        store.indexOf("function snapshot"),
        store.indexOf("function buildProviderFor"),
    );
    assert.doesNotMatch(persistentSnapshot, /ApiKey/);
});
