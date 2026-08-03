import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function readSourceTree(directoryUrl) {
    const entries = await readdir(directoryUrl, { withFileTypes: true });
    const parts = await Promise.all(entries.map(async (entry) => {
        const entryUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
        if (entry.isDirectory()) return readSourceTree(entryUrl);
        if (!/\.(?:ts|tsx)$/.test(entry.name)) return "";
        return readFile(entryUrl, "utf8");
    }));
    return parts.join("\n");
}

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
    assert.match(publishJob, /-c "include\.path=\$\{credentials_config\}" push --force/);
    assert.doesNotMatch(publishJob, /config "http\..*extraheader"/);
});

test("browser code cannot receive an AI Hub service credential", async () => {
    const [source, viteConfig, packageJson] = await Promise.all([
        readSourceTree(new URL("../src/", import.meta.url)),
        readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
        readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);
    const browserSurface = `${source}\n${viteConfig}\n${packageJson}`;

    assert.doesNotMatch(
        browserSurface,
        /AI_GATEWAY_SERVICE_TOKEN|ECLIPSE_AI_HUB_SERVICE_TOKEN|VITE_[A-Z0-9_]*SERVICE_TOKEN/,
    );
    assert.doesNotMatch(browserSurface, /\/v1\/telemetry/);
});

test("managed sign-in uses PKCE and the BFF owns cookie, CSRF and service credentials", async () => {
    const [browserAuth, bffServer, bffConfig, html] = await Promise.all([
        readFile(new URL("../src/model/auth/dndSession.ts", import.meta.url), "utf8"),
        readFile(new URL("../bff/src/server.mjs", import.meta.url), "utf8"),
        readFile(new URL("../bff/src/config.mjs", import.meta.url), "utf8"),
        readFile(new URL("../index.html", import.meta.url), "utf8"),
    ]);

    assert.match(browserAuth, /code_challenge_method", "S256"/);
    assert.match(browserAuth, /sessionStorage\.setItem\(SESSION_STORAGE_KEY/);
    assert.match(browserAuth, /sameState\(returnedState, stored\.state\)/);
    assert.match(browserAuth, /credentials: "include"/);
    assert.doesNotMatch(browserAuth, /localStorage|SERVICE_TOKEN|Authorization:\s*`Bearer/);
    assert.match(html, /<meta name="referrer" content="no-referrer"/);

    assert.match(bffServer, /requestOrigin !== config\.publicOrigin/);
    assert.match(bffServer, /X-CSRF-Token/);
    assert.match(bffServer, /HttpOnly; SameSite=Lax/);
    assert.match(bffServer, /Authorization: `Bearer \$\{config\.aiGatewayServiceToken\}`/);
    assert.match(bffConfig, /DND_AI_GATEWAY_SERVICE_TOKEN/);
    assert.doesNotMatch(bffConfig, /VITE_[A-Z0-9_]*SERVICE_TOKEN/);
});

test("identity canary can validate PKCE without enabling managed AI", async () => {
    const [browserAuth, canaryPage, launcher, workflow] = await Promise.all([
        readFile(new URL("../src/model/auth/dndSession.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/view/auth/IdentityCanaryPage.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/view/Launcher.tsx", import.meta.url), "utf8"),
        readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"),
    ]);

    assert.match(browserAuth, /intent === "managed" && !MANAGED_AI_ENABLED/);
    assert.match(browserAuth, /intent === "canary" && !IDENTITY_CANARY_ENABLED/);
    assert.match(canaryPage, /beginEclipseSignIn\("canary"\)/);
    assert.match(canaryPage, /Managed AI остался выключен/);
    assert.doesNotMatch(canaryPage, /dndApiJson|EclipseGatewayProvider|chat\/completions/);
    assert.match(launcher, /\{MANAGED_AI_ENABLED && <Tab key="eclipse"/);
    assert.match(workflow, /VITE_DND_IDENTITY_CANARY_ENABLED: true/);
    assert.doesNotMatch(workflow, /VITE_DND_MANAGED_AI_ENABLED:\s*true/);
});
