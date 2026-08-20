import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("canvas tabs stay clear of campaign actions", async () => {
    const [view, timeline, history, styles] = await Promise.all([
        readFile(new URL("../src/view/VisualWritingInterface.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/view/actionTimeline/ActionTimeline.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/view/HistoryTree.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/index.css", import.meta.url), "utf8"),
    ]);

    assert.match(view, /className='dnd-canvas-tabs'/);
    assert.match(view, /className='dnd-quick-actions' role='toolbar' aria-label='Инструменты кампании'/);
    assert.match(styles, /\.dnd-canvas-tabs\s*\{[^}]*top:\s*10px;/s);
    assert.match(styles, /\.dnd-quick-actions\s*\{[^}]*top:\s*58px;/s);
    assert.match(styles, /:focus-visible\s*\{/);
    assert.match(view, /aria-label="Очистить холст"/);
    assert.match(view, /aria-label="Обновить граф из текста"/);
    assert.match(view, /aria-label="Переписать текст из графа"/);
    assert.match(timeline, /aria-label="Прокрутить таймлайн влево"/);
    assert.match(timeline, /aria-label="Прокрутить таймлайн вправо"/);
    assert.match(history, /aria-label="Отменить последнее изменение"/);
    assert.match(history, /aria-label="Вернуть отменённое изменение"/);
});

test("mobile workspace exposes one obvious pane and bounded overlays", async () => {
    const panelFiles = [
        "DiceRollerPanel.tsx",
        "DmAgentPanel.tsx",
        "EncounterGeneratorPanel.tsx",
        "InitiativePanel.tsx",
        "MapWorkflowPanel.tsx",
        "NpcDialoguePanel.tsx",
        "NpcGeneratorPanel.tsx",
        "PlayModePanel.tsx",
        "ReferenceBoardPanel.tsx",
        "SessionsPanel.tsx",
        "WorldTickPanel.tsx",
    ];
    const [view, launcher, styles, ...panels] = await Promise.all([
        readFile(new URL("../src/view/VisualWritingInterface.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/view/Launcher.tsx", import.meta.url), "utf8"),
        readFile(new URL("../src/index.css", import.meta.url), "utf8"),
        ...panelFiles.map((file) => readFile(new URL(`../src/view/dnd/${file}`, import.meta.url), "utf8")),
    ]);

    assert.match(view, /dnd-mobile-view-switcher/);
    assert.match(view, /mobile-pane-\$\{mobilePane\}/);
    assert.match(launcher, /launcher-provider-tabs/);
    assert.match(styles, /@media \(max-width: 760px\)/);
    assert.match(styles, /\.mobile-pane-story \.dnd-visual-column/);
    assert.match(styles, /\.dnd-overlay-panel\s*\{[^}]*width: calc\(100vw - 24px\) !important;/s);
    panels.forEach((panel, index) => {
        assert.match(panel, /className="[^"]*\bdnd-overlay-panel\b[^"]*"/, `${panelFiles[index]} must use the bounded mobile overlay`);
    });
});

test("visual contract uses only self-hosted fonts", async () => {
    const [html, styles] = await Promise.all([
        readFile(new URL("../index.html", import.meta.url), "utf8"),
        readFile(new URL("../src/index.css", import.meta.url), "utf8"),
    ]);

    assert.doesNotMatch(html, /fonts[.]googleapis[.]com|fonts[.]gstatic[.]com/);
    assert.match(styles, /src: url\('\/fonts\/inter-cyrillic[.]woff2'\)/);
    assert.match(styles, /src: url\('\/fonts\/outfit-latin[.]woff2'\)/);
});
