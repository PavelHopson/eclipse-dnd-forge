import assert from "node:assert/strict";
import test from "node:test";
import { readActionCheck, readPlayerAction, resolveD20Check } from "../src/model/dnd/sharedTableContract.ts";

const sequence = (...values) => {
    let index = 0;
    return () => values[index++];
};

test("d20 resolution selects the higher advantage roll and applies the DC", () => {
    const result = resolveD20Check({ dc: 18, modifier: 2, mode: "advantage" }, sequence(0.1, 0.9));
    assert.deepEqual(result.rolls, [3, 19]);
    assert.equal(result.selected, 19);
    assert.equal(result.total, 21);
    assert.equal(result.outcome, "success");
    assert.equal(result.success, true);
});

test("natural 20 and natural 1 override the numeric check", () => {
    const criticalSuccess = resolveD20Check({ dc: 40, modifier: -20, mode: "normal" }, sequence(0.999));
    assert.equal(criticalSuccess.natural, 20);
    assert.equal(criticalSuccess.outcome, "critical-success");
    assert.equal(criticalSuccess.success, true);

    const criticalFailure = resolveD20Check({ dc: 1, modifier: 20, mode: "normal" }, sequence(0));
    assert.equal(criticalFailure.natural, 1);
    assert.equal(criticalFailure.outcome, "critical-failure");
    assert.equal(criticalFailure.success, false);
});

test("d20 input validates bounded DC, modifier and mode", () => {
    assert.deepEqual(readPlayerAction({
        id: "action-12345678-check",
        actor: "Иара",
        text: "Проверяю замок",
        diceExpression: "d20",
    }), { id: "action-12345678-check", actor: "Иара", text: "Проверяю замок", diceExpression: "d20" });
    assert.deepEqual(readActionCheck({
        actionId: "action-12345678-check", dc: 15, modifier: -2, mode: "disadvantage", baseRevision: 2,
    }).check, { dc: 15, modifier: -2, mode: "disadvantage" });

    for (const resolution of [
        { dc: 0, modifier: 0, mode: "normal" },
        { dc: 41, modifier: 0, mode: "normal" },
        { dc: 10, modifier: -21, mode: "normal" },
        { dc: 10, modifier: 21, mode: "normal" },
        { dc: 10, modifier: 0, mode: "loaded" },
    ]) {
        assert.throws(() => readActionCheck({
            actionId: "action-12345678-check", ...resolution, baseRevision: 2,
        }), /проверка d20/i);
    }
});

test("advantage and disadvantage keep the selected natural result", () => {
    const advantageNatOne = resolveD20Check({ dc: 10, modifier: 0, mode: "advantage" }, sequence(0, 0.95));
    assert.deepEqual(advantageNatOne.rolls, [1, 20]);
    assert.equal(advantageNatOne.natural, 20);
    assert.equal(advantageNatOne.outcome, "critical-success");

    const disadvantageNatOne = resolveD20Check({ dc: 1, modifier: 20, mode: "disadvantage" }, sequence(0, 0.95));
    assert.deepEqual(disadvantageNatOne.rolls, [1, 20]);
    assert.equal(disadvantageNatOne.natural, 1);
    assert.equal(disadvantageNatOne.outcome, "critical-failure");
});
