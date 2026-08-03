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

test("Pages deploy isolates the build from the write token", async () => {
    const workflow = await readFile(
        new URL("../.github/workflows/deploy.yml", import.meta.url),
        "utf8",
    );
    const buildJob = workflow.slice(workflow.indexOf("  build:"), workflow.indexOf("  publish:"));
    const publishJob = workflow.slice(workflow.indexOf("  publish:"));
    const actions = [...workflow.matchAll(/^\s+(?:-\s+)?uses:\s+(\S+)/gm)].map((match) => match[1]);

    assert.match(workflow, /^permissions: \{\}$/m);
    assert.doesNotMatch(workflow, /s0\/git-publish-subdir-action|\bnode20\b/i);
    assert.ok(actions.length >= 5);
    for (const action of actions) {
        assert.match(action, /^actions\/[a-z-]+@[0-9a-f]{40}$/);
    }

    assert.match(buildJob, /permissions:\s*\n\s+contents: read/);
    assert.match(buildJob, /persist-credentials: false/);
    assert.doesNotMatch(buildJob, /contents: write/);
    assert.match(buildJob, /npm ci --ignore-scripts --no-audit/);

    assert.match(publishJob, /needs: build/);
    assert.match(publishJob, /permissions:\s*\n\s+contents: write/);
    assert.match(publishJob, /digest-mismatch: error/);
    assert.match(publishJob, /test "\$\(cat build\/CNAME\)" = "dnd\.eclipse-forge\.ru"/);
});
