import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('launcher defers the campaign workspace and legacy study surfaces', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.ok(app.includes("lazy(() => import('./view/VisualWritingInterface'))"));
  assert.ok(app.includes("lazy(() => import('./study/StudyInterface'))"));
  assert.ok(app.includes("lazy(() => import('./study/BaselineInterface'))"));
  assert.ok(!app.includes('import VisualWritingInterface from'));
  assert.ok(app.includes('<Suspense fallback={<RouteLoading />}>'));
  assert.ok(app.includes('aria-live="polite" aria-busy="true"'));
});

test('launcher keeps editor and provider implementations behind runtime boundaries', async () => {
  const [app, launcher, configStore, templates] = await Promise.all([
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/view/Launcher.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/store/useAiConfigStore.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/model/dnd/campaignTemplates.ts', import.meta.url), 'utf8'),
  ]);

  assert.ok(app.includes("await import('./study/StudyModel')"));
  assert.ok(launcher.includes('await import("../model/dnd/campaignRuntime")'));
  assert.ok(!launcher.includes("from '../model/Model'"));
  assert.ok(!launcher.includes('react-icons'));
  assert.ok(configStore.includes('await import("../model/ai/providerFactory")'));
  assert.ok(!configStore.includes('from "../model/ai/OpenAIProvider"'));
  assert.ok(!configStore.includes('from "../model/ai/AnthropicProvider"'));
  assert.ok(!templates.includes('CreateEntityNode'));
  assert.ok(!templates.includes('CreateLocatioNode'));
  assert.ok(!templates.includes('seedToNodes'));
});
