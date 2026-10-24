import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared table UI lets the master request a server-owned d20 check", async () => {
    const page = await readFile(new URL("../src/view/dnd/SharedTablePage.tsx", import.meta.url), "utf8");

    assert.match(page, /type: "action\.check"/);
    assert.match(page, /\/checks/);
    assert.match(page, /Рассчитать d20/);
    assert.match(page, /DC и режим проверки задаёт ведущий/);
    assert.match(page, /data-testid="shared-table-resolution"/);
    assert.match(page, /Критический успех/);
    assert.match(page, /Критический провал/);
});

test("shared table lets the master answer an unresolved player action", async () => {
    const page = await readFile(new URL("../src/view/dnd/SharedTablePage.tsx", import.meta.url), "utf8");

    assert.match(page, /const \[replyDrafts, setReplyDrafts\] = useState<Record<string, string>>\(\{\}\)/);
    assert.match(page, /type: "action\.resolve"/);
    assert.match(page, /\/responses/);
    assert.match(page, /Ответить игроку/);
    assert.match(page, /Ответ ведущего/);
});

test("shared table keeps initiative turn controls server-owned and player-safe", async () => {
    const page = await readFile(new URL("../src/view/dnd/SharedTablePage.tsx", import.meta.url), "utf8");

    assert.match(page, /type: eventType/);
    assert.match(page, /initiative\.start/);
    assert.match(page, /initiative\.advance/);
    assert.match(page, /initiative\.end/);
    assert.match(page, /Начать бой/);
    assert.match(page, /Следующий ход/);
    assert.match(page, /Завершить бой/);
    assert.match(page, /Раунд \{room\.turn\.round\}/);
});
