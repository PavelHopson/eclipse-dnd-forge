import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared table UI sends local d20 checks and renders the server result", async () => {
    const page = await readFile(new URL("../src/view/dnd/SharedTablePage.tsx", import.meta.url), "utf8");

    assert.match(page, /const \[checkDc, setCheckDc\] = useState\("10"\)/);
    assert.match(page, /const \[checkModifier, setCheckModifier\] = useState\("0"\)/);
    assert.match(page, /useState<D20Mode>\("normal"\)/);
    assert.match(page, /diceExpression\.startsWith\("d20"\)/);
    assert.match(page, /body: JSON\.stringify\(\{ id: actionId, actor: character, text: actionText, diceExpression, .*resolution \? \{ resolution \} : \{\}/);
    assert.match(page, /data-testid="shared-table-resolution-fields"/);
    assert.match(page, /data-testid="shared-table-resolution"/);
    assert.match(page, /Критический успех/);
    assert.match(page, /Критический провал/);
    assert.match(page, /серверной кампании пока используется обычный бросок/);
});
