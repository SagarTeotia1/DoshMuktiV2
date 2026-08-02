import type { FastifyRequest, FastifyReply } from 'fastify';
import { chatRequestSchema } from './schema';
import { sendMessage } from './service';

export async function chatHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const text = await sendMessage(parsed.data);
  return reply.send({ reply: text });
}
