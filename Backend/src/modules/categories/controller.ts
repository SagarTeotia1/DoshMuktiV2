import type { FastifyRequest, FastifyReply } from 'fastify';
import { createCategorySchema, updateCategorySchema, idParamSchema } from './schema';
import {
  listCategoriesForAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  CategoryNotFoundError,
  DuplicateCategoryError,
  CategoryInUseError,
} from './service';

export async function listCategoriesHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listCategoriesForAdmin());
}

export async function createCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    return reply.code(201).send(await createCategory(parsed.data));
  } catch (err) {
    if (err instanceof DuplicateCategoryError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}

export async function updateCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    return reply.send(await updateCategory(params.data.id, parsed.data));
  } catch (err) {
    if (err instanceof CategoryNotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof DuplicateCategoryError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}

export async function deleteCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  try {
    await deleteCategory(params.data.id);
    return reply.code(204).send();
  } catch (err) {
    if (err instanceof CategoryNotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof CategoryInUseError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}
