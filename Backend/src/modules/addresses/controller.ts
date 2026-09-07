import type { FastifyRequest, FastifyReply } from 'fastify';
import { addressSchema, idParamSchema } from './schema';
import { listAddresses, saveAddress, updateAddress, deleteAddress, AddressNotFoundError } from './service';

function accountPhone(req: FastifyRequest): string {
  return (req.user as { phone: string }).phone;
}

export async function listAddressesHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listAddresses(accountPhone(req)));
}

export async function createAddressHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const address = await saveAddress(accountPhone(req), parsed.data);
  return reply.code(201).send(address);
}

export async function updateAddressHandler(req: FastifyRequest, reply: FastifyReply) {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) return reply.code(400).send({ error: 'Invalid id' });
  const bodyParsed = addressSchema.safeParse(req.body);
  if (!bodyParsed.success) return reply.code(400).send({ error: 'Invalid input', details: bodyParsed.error.flatten().fieldErrors });

  try {
    const address = await updateAddress(accountPhone(req), idParsed.data.id, bodyParsed.data);
    return reply.send(address);
  } catch (err) {
    if (err instanceof AddressNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}

export async function deleteAddressHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid id' });

  try {
    await deleteAddress(accountPhone(req), parsed.data.id);
    return reply.code(204).send();
  } catch (err) {
    if (err instanceof AddressNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}
