import type { FastifyRequest, FastifyReply } from 'fastify';
import { createSectionSchema, updateSectionSchema, setSectionItemsSchema, idParamSchema } from './schema';
import {
  getActiveHomepageSections,
  listHomepageSectionsForAdmin,
  createSection,
  updateSection,
  setSectionItems,
  deleteSection,
  HomepageSectionNotFoundError,
  HomepageSectionKeyTakenError,
} from './service';

export async function getActiveHomepageSectionsHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getActiveHomepageSections());
}

export async function listHomepageSectionsHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listHomepageSectionsForAdmin());
}

export async function createHomepageSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createSectionSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const section = await createSection(parsed.data);
    return reply.code(201).send(section);
  } catch (err) {
    if (err instanceof HomepageSectionKeyTakenError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}

export async function updateHomepageSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = updateSectionSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const section = await updateSection(params.data.id, parsed.data);
    return reply.send(section);
  } catch (err) {
    if (err instanceof HomepageSectionNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}

export async function setHomepageSectionItemsHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = setSectionItemsSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const section = await setSectionItems(params.data.id, parsed.data.productIds);
    return reply.send(section);
  } catch (err) {
    if (err instanceof HomepageSectionNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}

export async function deleteHomepageSectionHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  try {
    await deleteSection(params.data.id);
    return reply.code(204).send();
  } catch (err) {
    if (err instanceof HomepageSectionNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}
