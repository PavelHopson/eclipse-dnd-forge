import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AtomicBudgetStore, BudgetExceededError } from '../src/budget.mjs';

const config = {
  budgetFile: undefined,
  userRequestsPer15Minutes: 1,
  userDailyTokens: 1_000,
  productDailyTokens: 10_000,
};

test('serializes concurrent reservations so parallel tabs cannot bypass the limit', async () => {
  const store = await AtomicBudgetStore.create(config);
  const results = await Promise.allSettled([
    store.reserve('user-1', 100, 1_800_000_000_000),
    store.reserve('user-1', 100, 1_800_000_000_000),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejection = results.find((result) => result.status === 'rejected');
  assert.ok(rejection.reason instanceof BudgetExceededError);
  assert.equal(rejection.reason.code, 'user_rate_limited');
});

test('reserves the maximum response before dispatch and reconciles actual usage', async () => {
  const store = await AtomicBudgetStore.create({ ...config, userRequestsPer15Minutes: 5 });
  const reservation = await store.reserve('user-1', 500, 1_800_000_000_000);
  await store.reconcile(reservation, 120);
  const second = await store.reserve('user-1', 850, 1_800_000_000_001);
  assert.equal(second.estimatedTokens, 850);
  await assert.rejects(
    store.reserve('user-1', 31, 1_800_000_000_002),
    (error) => error instanceof BudgetExceededError && error.code === 'user_daily_budget_exhausted',
  );
});

test('fails closed instead of resetting a corrupted persisted budget', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eclipse-dnd-budget-'));
  const budgetFile = join(directory, 'budgets.json');
  try {
    await writeFile(budgetFile, '{"version":1,"day":"broken"', 'utf8');
    await assert.rejects(
      AtomicBudgetStore.create({ ...config, budgetFile }),
      /JSON|Unexpected|position|after JSON/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
