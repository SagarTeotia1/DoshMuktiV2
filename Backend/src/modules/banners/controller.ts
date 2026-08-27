import type { FastifyRequest, FastifyReply } from 'fastify';
import { createBannerSchema, updateBannerSchema, idParamSchema } from './schema';
import { getActiveBanners, listBannersForAdmin, createBanner, updateBanner, deleteBanner, BannerNotFoundError } from './service';

export async function getActiveBannersHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getActiveBanners());
}

export async function listBannersHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listBannersForAdmin());
}

export async function createBannerHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createBannerSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const banner = await createBanner(parsed.data);
  return reply.code(201).send(banner);
}

export async function updateBannerHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = updateBannerSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const banner = await updateBanner(params.data.id, parsed.data);
    return reply.send(banner);
  } catch (err) {
    if (err instanceof BannerNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}

export async function deleteBannerHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  try {
    await deleteBanner(params.data.id);
    return reply.code(204).send();
  } catch (err) {
    if (err instanceof BannerNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}
