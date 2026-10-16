import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';
import { releaseExpiredHolds } from './release-holds';
import { syncOpenShipments, SyncBusyError, CRON_SYNC_LIMIT } from './tracking-sync';
import { sendLowStockDigest } from './low-stock-digest';
import { warmCache } from './warm-cache';

function verifyCronSecret(req: FastifyRequest, reply: FastifyReply): boolean {
  const auth = req.headers.authorization ?? '';
  const expected = `Bearer ${env.CRON_SECRET}`;
  const authBuf = Buffer.from(auth);
  const expBuf = Buffer.from(expected);

  if (authBuf.length !== expBuf.length || !crypto.timingSafeEqual(authBuf, expBuf)) {
    reply.code(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export async function jobRoutes(app: FastifyInstance) {
  app.post('/jobs/release-holds', async (req, reply) => {
    if (!verifyCronSecret(req, reply)) return;
    return reply.send(await releaseExpiredHolds());
  });

  app.post('/jobs/tracking-sync', async (req, reply) => {
    if (!verifyCronSecret(req, reply)) return;
    try {
      return reply.send(await syncOpenShipments('all', CRON_SYNC_LIMIT));
    } catch (err) {
      // Admin's manual sync already running: not a failure, the scheduler shouldn't retry-storm.
      if (err instanceof SyncBusyError) return reply.code(200).send({ skipped: true, reason: err.message });
      throw err;
    }
  });

  app.post('/jobs/low-stock-digest', async (req, reply) => {
    if (!verifyCronSecret(req, reply)) return;
    return reply.send(await sendLowStockDigest());
  });

  app.post('/jobs/warm-cache', async (req, reply) => {
    if (!verifyCronSecret(req, reply)) return;
    return reply.send(await warmCache());
  });
}
