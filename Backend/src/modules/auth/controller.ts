import type { FastifyRequest, FastifyReply } from 'fastify';
import { adminLoginSchema, sendOtpSchema, verifyOtpSchema } from './schema';
import {
  verifyAdminCredentials,
  InvalidCredentialsError,
  sendCustomerOtp,
  verifyCustomerOtp,
  InvalidOtpError,
  ProfileRequiredError,
} from './service';
import { db } from '../../shared/db/client';

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

export async function sendOtpHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });

  await sendCustomerOtp(parsed.data.phone);
  return reply.send({ sent: true });
}

export async function verifyOtpHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });

  try {
    const user = await verifyCustomerOtp(parsed.data.phone, parsed.data.otp, parsed.data.name, parsed.data.dob);
    const token = await reply.jwtSign({ sub: user.id, phone: user.phone, role: 'customer' }, { expiresIn: '180d' });
    return reply.send({ token, user: { id: user.id, name: user.name, phone: user.phone, dob: user.dob } });
  } catch (err) {
    if (err instanceof ProfileRequiredError) {
      return reply.code(422).send({ error: err.message, code: 'PROFILE_REQUIRED' });
    }
    if (err instanceof InvalidOtpError) {
      return reply.code(400).send({ error: err.message });
    }
    throw err;
  }
}

export async function meHandler(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req.user as { sub: string }).sub;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return reply.code(404).send({ error: 'Account not found' });

  return reply.send({ id: user.id, name: user.name, phone: user.phone, dob: user.dob });
}
