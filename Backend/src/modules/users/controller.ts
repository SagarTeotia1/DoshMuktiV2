import type { FastifyRequest, FastifyReply } from 'fastify';
import { listUsersQuerySchema, idParamSchema } from './schema';
import { listUsers, getUserById } from './service';

export async function listUsersHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });

  return reply.send(await listUsers(parsed.data));
}

export async function getUserByIdHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid id' });

  const user = await getUserById(parsed.data.id);
  if (!user) return reply.code(404).send({ error: 'User not found' });

  return reply.send(user);
}
