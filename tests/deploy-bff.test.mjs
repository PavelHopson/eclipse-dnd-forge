import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const bootstrap = read('../deploy/scripts/bootstrap-dark.sh');
const sync = read('../deploy/scripts/sync-bff-supervisor.sh');
const runner = read('../deploy/scripts/run-bff.sh');
const supervisor = read('../deploy/supervisor/eclipse-dnd-forge-bff.conf');

test('dark launch isolates the process and keeps AI disabled', () => {
  assert.match(supervisor, /user=eclipse-dnd-bff/);
  assert.doesNotMatch(supervisor, /user=root/);
  assert.match(sync, /root:eclipse-dnd-bff mode 0640/);
  assert.match(bootstrap, /write_env_line "DND_BFF_AI_ENABLED" "false"/);
  assert.match(bootstrap, /health\?\.aiEnabled !== false/);
  assert.match(runner, /exec node bff\/src\/index\.mjs/);
});

test('dark launch creates only a least-privileged DnD gateway client', () => {
  assert.match(bootstrap, /CLIENT_ID="eclipse-dnd-forge"/);
  assert.match(bootstrap, /CLIENT_SCOPES="models:read,chat:write"/);
  assert.doesNotMatch(bootstrap, /CLIENT_SCOPES="[^"]*telemetry:read/);
  assert.match(bootstrap, /DND_TELEMETRY_STATUS/);
  assert.match(bootstrap, /DND_TELEMETRY_STATUS" != "403"/);
  assert.match(bootstrap, /CHAT_TELEMETRY_STATUS" != "200"/);
});

test('dark launch is pinned, rollback-capable and does not trace secrets', () => {
  assert.match(bootstrap, /full pinned commit SHAs/);
  assert.match(bootstrap, /Previous gateway and DnD BFF environments restored/);
  assert.match(bootstrap, /Origin: https:\/\/evil\.example/);
  assert.doesNotMatch(bootstrap, /set -x|echo.*SERVICE_TOKEN/);
});
