import type { FastifyRequest, FastifyReply } from 'fastify';
import { chatRequestSchema } from './schema';
import { sendMessage } from './service';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';

function sessionIdOf(req: FastifyRequest): string | null {
  const id = req.headers['x-session-id'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

// The per-route burst limit in chat/routes.ts (15/min) stops rapid-fire spam but not a
// single visitor grinding steadily for hours — that's what actually runs up the LLM
// bill over a day. Keyed by IP, not the client-supplied x-session-id: session id is
// trivially rotated by anyone actually trying to get around a cap, req.ip isn't.
// Generous enough that no real conversation (even a long back-and-forth reading) would
// ever hit it — this is an abuse floor, not a UX limit.
const DAILY_MESSAGE_LIMIT = 60;

export async function chatHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const dailyCount = await redis.incr(cacheKeys.chatDailyCount(req.ip), CACHE_TTL.CHAT_DAILY_LIMIT);
  if (dailyCount > DAILY_MESSAGE_LIMIT) {
    // No LLM call at all past this point — the whole point is to stop paying for it.
    return reply.code(429).send({
      error: "You've reached today's chat limit with Acharya Madhav — please try again tomorrow, or reach us on WhatsApp.",
      code: 'CHAT_DAILY_LIMIT',
    });
  }

  const result = await sendMessage(parsed.data, sessionIdOf(req));
  return reply.send({
    reply: result.reply,
    recommendedProducts: result.recommendedProducts,
    recommendationReason: result.recommendationReason,
  });
}
