import type { FastifyRequest, FastifyReply } from 'fastify';
import { adminLoginSchema } from './schema';
import { verifyAdminCredentials, InvalidCredentialsError } from './service';

export async function adminLoginHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
  }

  try {
    const admin = await verifyAdminCredentials(parsed.data);
    const token = await reply.jwtSign({ sub: admin.email, role: admin.role }, { expiresIn: '12h' });
    return reply.send({ token });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return reply.code(401).send({ error: err.message });
    }
    throw err;
  }
}
