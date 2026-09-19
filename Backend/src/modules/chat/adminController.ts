import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../../shared/cache/client';
import { cacheKeys } from '../../shared/cache/keys';
import { db } from '../../shared/db/client';
import { chatLeadListQuerySchema, type ChatSessionRecord } from './schema';
import { z } from 'zod';

export async function listChatSessionsHandler(_req: FastifyRequest, reply: FastifyReply) {
  const keys = await redis.keys(`${cacheKeys.chatSessionPrefix()}*`);
  const records = await Promise.all(keys.map((k) => redis.get<ChatSessionRecord>(k)));

  const sessions = records
    .filter((r): r is ChatSessionRecord => r !== null)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .map((r) => ({
      sessionId: r.sessionId,
      ip: r.ip,
      phone: r.phone ?? null,
      name: r.name ?? null,
      dob: r.dob ?? null,
      problem: r.problem ?? null,
      city: r.city,
      country: r.country,
      startedAt: r.startedAt,
      lastMessageAt: r.lastMessageAt,
      messageCount: r.messages.length,
      lastMessagePreview: r.messages[r.messages.length - 1]?.content.slice(0, 140) ?? '',
    }));

  return reply.send({ sessions });
}

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

export async function listChatLeadsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = chatLeadListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid query params', details: parsed.error.flatten().fieldErrors });
  }

  const { page, limit, search, status } = parsed.data;
  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { phone: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { problem: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [leads, total] = await Promise.all([
    db.chatLead.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.chatLead.count({ where }),
  ]);

  return reply.send({
    leads,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
}

const updateLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional(),
  notes: z.string().optional(),
});

export async function updateChatLeadStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateLeadStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten().fieldErrors });
  }

  const lead = await db.chatLead.update({
    where: { id },
    data: parsed.data,
  });

  return reply.send(lead);
}
