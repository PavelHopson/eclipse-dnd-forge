import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadBffConfig } from './config.mjs';
import { createDndBffServer } from './server.mjs';

async function start() {
  const config = loadBffConfig();
  const server = await createDndBffServer(config);
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(config.port, config.host, resolveListen);
  });
  console.info({ event: 'dnd_bff_started', host: config.host, port: config.port });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  start().catch((error) => {
    console.error({ event: 'dnd_bff_start_failed', error: error instanceof Error ? error.message : 'unknown' });
    process.exit(1);
  });
}
