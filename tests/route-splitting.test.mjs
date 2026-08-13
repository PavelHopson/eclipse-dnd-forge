import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('launcher defers the campaign workspace and legacy study surfaces', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.match(app, /lazy\(\(\) => import\('\.\/view\/VisualWritingInterface'\)\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\/study\/StudyInterface'\)\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\/study\/BaselineInterface'\)\)/);
  assert.doesNotMatch(app, /import VisualWritingInterface from/);
  assert.match(app, /<Suspense fallback=\{<RouteLoading \/>\}>/);
  assert.match(app, /aria-live="polite" aria-busy="true"/);
});