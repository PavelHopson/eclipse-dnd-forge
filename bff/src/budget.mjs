import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class BudgetExceededError extends Error {
  constructor(code, message, retryAt) {
    super(message);
    this.code = code;
    this.retryAt = retryAt;
    this.name = 'BudgetExceededError';
  }
}

function utcDay(now) {
  return new Date(now).toISOString().slice(0, 10);
}

function emptyState(day) {
  return { version: 1, day, productTokens: 0, users: {} };
}

function validState(value) {
  return value && value.version === 1 && typeof value.day === 'string' &&
    Number.isSafeInteger(value.productTokens) && value.productTokens >= 0 &&
    value.users && typeof value.users === 'object' && !Array.isArray(value.users);
}

export class AtomicBudgetStore {
  constructor(config, state = emptyState(utcDay(Date.now()))) {
    this.config = config;
    this.state = state;
    this.queue = Promise.resolve();
  }

  static async create(config) {
    let state;
    if (config.budgetFile) {
      try {
        const parsed = JSON.parse(await readFile(config.budgetFile, 'utf8'));
        if (!validState(parsed)) throw new Error('DND BFF budget file has an invalid schema');
        state = parsed;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    return new AtomicBudgetStore(config, state);
  }

  transaction(operation) {
    const task = this.queue.then(operation, operation);
    this.queue = task.catch(() => undefined);
    return task;
  }

  resetDayIfNeeded(now) {
    const day = utcDay(now);
    if (this.state.day !== day) this.state = emptyState(day);
  }

  async persist() {
    if (!this.config.budgetFile) return;
    const target = this.config.budgetFile;
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(this.state), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, target);
  }

  reserve(subject, estimatedTokens, now = Date.now()) {
    return this.transaction(async () => {
      this.resetDayIfNeeded(now);
      const snapshot = structuredClone(this.state);
      const existing = this.state.users[subject] || {
        tokens: 0,
        windowStartedAt: now,
        windowRequests: 0,
      };
      if (now - existing.windowStartedAt >= 15 * 60_000) {
        existing.windowStartedAt = now;
        existing.windowRequests = 0;
      }
      const nextWindowRequests = existing.windowRequests + 1;
      const retryAt = existing.windowStartedAt + 15 * 60_000;
      if (nextWindowRequests > this.config.userRequestsPer15Minutes) {
        throw new BudgetExceededError('user_rate_limited', 'Слишком много AI-запросов. Попробуйте позже.', retryAt);
      }
      const nextUserTokens = existing.tokens + estimatedTokens;
      if (nextUserTokens > this.config.userDailyTokens) {
        throw new BudgetExceededError('user_daily_budget_exhausted', 'Дневной AI-лимит исчерпан.', Date.parse(`${this.state.day}T00:00:00.000Z`) + 86_400_000);
      }
      const nextProductTokens = this.state.productTokens + estimatedTokens;
      if (nextProductTokens > this.config.productDailyTokens) {
        throw new BudgetExceededError('product_daily_budget_exhausted', 'AI временно недоступен: общий дневной лимит исчерпан.', Date.parse(`${this.state.day}T00:00:00.000Z`) + 86_400_000);
      }
      existing.windowRequests = nextWindowRequests;
      existing.tokens = nextUserTokens;
      this.state.users[subject] = existing;
      this.state.productTokens = nextProductTokens;
      try {
        await this.persist();
      } catch (error) {
        this.state = snapshot;
        throw error;
      }
      return { subject, estimatedTokens, day: this.state.day };
    });
  }

  reconcile(reservation, actualTokens) {
    return this.transaction(async () => {
      if (!Number.isSafeInteger(actualTokens) || actualTokens < 0 || reservation.day !== this.state.day) return;
      const user = this.state.users[reservation.subject];
      if (!user) return;
      const delta = actualTokens - reservation.estimatedTokens;
      user.tokens = Math.max(0, user.tokens + delta);
      this.state.productTokens = Math.max(0, this.state.productTokens + delta);
      await this.persist();
    });
  }
}
