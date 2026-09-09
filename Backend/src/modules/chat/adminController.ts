import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../../shared/cache/client';
import { cacheKeys } from '../../shared/cache/keys';
import type { ChatSessionRecord } from './schema';

// One Redis command per admin page load (KEYS scan) + one GET per matched session — cheap
// at the traffic this store is sized for (sessions self-expire after CACHE_TTL.CHAT_SESSION,
// so the key count never grows unbounded). Worth revisiting (a proper index instead of a
// KEYS scan) only if the admin team's actual session volume grows enough for this to show
// up in Redis usage/latency.
export async function listChatSessionsHandler(_req: FastifyRequest, reply: FastifyReply) {
  const keys = await redis.keys(`${cacheKeys.chatSessionPrefix()}*`);
  const records = await Promise.all(keys.map((k) => redis.get<ChatSessionRecord>(k)));

  const sessions = records
    .filter((r): r is ChatSessionRecord => r !== null)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .map((r) => ({
      sessionId: r.sessionId,
      ip: r.ip,
      city: r.city,
      country: r.country,
      startedAt: r.startedAt,
      lastMessageAt: r.lastMessageAt,
      messageCount: r.messages.length,
      lastMessagePreview: r.messages[r.messages.length - 1]?.content.slice(0, 140) ?? '',
    }));

  return reply.send({ sessions });
}

// Direct key construction for each of the last N days, not a KEYS scan — cheap and
// exact regardless of how much other chat:* data exists in Redis.
export async function getChatVolumeHandler(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { days?: string };
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 90);

  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const counts = await Promise.all(dates.map((date) => redis.get<number>(cacheKeys.chatDailyVolume(date))));
  return reply.send({ trend: dates.map((date, i) => ({ date, count: counts[i] ?? 0 })) });
}

export async function getChatSessionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { sessionId } = req.params as { sessionId: string };
  const record = await redis.get<ChatSessionRecord>(cacheKeys.chatSession(sessionId));
  if (!record) return reply.code(404).send({ error: 'Session not found' });
  return reply.send(record);
}
