import type { FastifyRequest, FastifyReply } from 'fastify';
import { chatRequestSchema } from './schema';
import { sendMessage } from './service';

function sessionIdOf(req: FastifyRequest): string | null {
  const id = req.headers['x-session-id'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export async function chatHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const result = await sendMessage(parsed.data, sessionIdOf(req));
  return reply.send({
    reply: result.reply,
    recommendedProducts: result.recommendedProducts,
    recommendationReason: result.recommendationReason,
  });
}
