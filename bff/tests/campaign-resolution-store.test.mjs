import assert from "node:assert/strict";
import test from "node:test";
import { CampaignStore, CampaignStoreError } from "../src/campaignStore.mjs";

test("remote campaign store accepts optional d20 resolution and persists a server result", async () => {
  const store = new CampaignStore({
    clock: (() => {
      let value = 1_700_000_000_000;
      return () => value++;
    })(),
    tokenBytes: () => Buffer.alloc(32, 7),
  });
  const created = await store.create("owner", "Ведущий", "Проверка remote d20");
  const result = await store.appendEvent({
    campaignId: created.campaignId,
    subject: "owner",
    type: "action.append",
    expectedRevision: 0,
    idempotencyKey: "action-resolution-1",
    payload: {
      id: "action-12345678-resolution",
      actor: "Иара",
      text: "Проверяю замок",
      diceExpression: "d20",
      resolution: { dc: 15, modifier: 2, mode: "advantage" },
    },
  });
  const action = result.event.payload.action;
  assert.equal(action.resolution.dc, 15);
  assert.equal(action.resolution.modifier, 2);
  assert.equal(action.resolution.mode, "advantage");
  assert.equal(action.resolution.rolls.length, 2);
  assert.equal(action.resolution.selected, Math.max(...action.resolution.rolls));
  assert.equal(action.resolution.natural, action.resolution.selected);
  assert.equal(action.resolution.total, action.resolution.selected + 2);
  assert.equal(action.dice.total, action.resolution.total);
  assert.deepEqual(store.get(created.campaignId, "owner").actions[0].resolution, action.resolution);

  const legacy = await store.appendEvent({
    campaignId: created.campaignId,
    subject: "owner",
    type: "action.append",
    expectedRevision: 1,
    idempotencyKey: "action-legacy-1",
    payload: { id: "action-12345678-legacy", actor: "Иара", text: "Иду дальше", diceExpression: "d20+3" },
  });
  assert.equal("resolution" in legacy.event.payload.action, false);

  for (const [index, resolution] of [
    { dc: 0, modifier: 0, mode: "normal" },
    { dc: 10, modifier: 21, mode: "normal" },
    { dc: 10, modifier: 0, mode: "loaded" },
  ].entries()) {
    await assert.rejects(
      () => store.appendEvent({
        campaignId: created.campaignId,
        subject: "owner",
        type: "action.append",
        expectedRevision: 2,
        idempotencyKey: `action-invalid-${index}`,
        payload: {
          id: `action-12345678-invalid-${index}`,
          actor: "Иара",
          text: "Проверка",
          diceExpression: "d20",
          resolution,
        },
      }),
      (error) => error instanceof CampaignStoreError && error.status === 400 && error.code === "invalid_resolution",
    );
  }
});
