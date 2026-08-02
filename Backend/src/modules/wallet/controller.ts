import type { FastifyRequest, FastifyReply } from 'fastify';
import { walletBalanceQuerySchema, adminWalletAdjustSchema } from './schema';
import { getBalance, adminAdjustBalance, InsufficientWalletBalanceError } from './service';

export async function getBalanceHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = walletBalanceQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid phone number' });

  const balance = await getBalance(parsed.data.phone);
  return reply.send({ balance });
}

export async function adminAdjustHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = adminWalletAdjustSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const balance = await adminAdjustBalance(parsed.data.phone, parsed.data.amount, parsed.data.note);
    return reply.send({ balance });
  } catch (err) {
    if (err instanceof InsufficientWalletBalanceError) return reply.code(400).send({ error: err.message });
    throw err;
  }
}
