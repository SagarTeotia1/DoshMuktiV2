import { buildApp } from './app';
import { env } from './config/env';
import { warmCache } from './jobs/warm-cache';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Every deploy/restart otherwise starts cold — the first visitor after a rollout would
  // pay the DB-query cost that Redis exists to avoid. Never blocks startup or crashes the
  // server on failure (warmCache itself already isolates and logs per-target failures).
  warmCache().catch((err) => app.log.error(err, 'startup cache warm failed'));
}

main();
