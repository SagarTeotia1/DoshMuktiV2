import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  listProductsQuerySchema,
  slugParamSchema,
  listAdminProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  idParamSchema,
} from './schema';
import {
  listProducts,
  getProductBySlug,
  getRelatedProducts,
  getFeaturedProducts,
  getDistinctCategories,
  getCategoryThumbnails,
  getDistinctCategoriesForAdmin,
  listProductsForAdmin,
  getProductByIdForAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  updateVariant,
  DuplicateSlugError,
  DuplicateNameError,
  ProductHasOrdersError,
} from './service';

export async function listProductsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listProductsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });
  }
  return reply.send(await listProducts(parsed.data));
}

export async function getProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = slugParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid slug' });

  const product = await getProductBySlug(parsed.data.slug);
  if (!product) return reply.code(404).send({ error: 'Product not found' });

  const related = await getRelatedProducts(product.id, product.purpose, 12);
  return reply.send({ product, related });
}

export async function getFeaturedHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getFeaturedProducts(12));
}

export async function getCategoriesHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getDistinctCategories());
}

export async function getCategoryThumbsHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getCategoryThumbnails());
}

// ─── Admin ──────────────────────────────────────────────────────────────

export async function getAdminCategoriesHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getDistinctCategoriesForAdmin());
}

export async function listAdminProductsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listAdminProductsQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
  return reply.send(await listProductsForAdmin(parsed.data));
}

export async function getAdminProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid id' });

  const product = await getProductByIdForAdmin(parsed.data.id);
  if (!product) return reply.code(404).send({ error: 'Product not found' });
  return reply.send(product);
}

export async function createProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const product = await createProduct(parsed.data);
    return reply.code(201).send(product);
  } catch (err) {
    if (err instanceof DuplicateSlugError) return reply.code(409).send({ error: err.message });
    if (err instanceof DuplicateNameError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}

export async function updateProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const product = await updateProduct(params.data.id, parsed.data);
    return reply.send(product);
  } catch (err) {
    if (err instanceof DuplicateSlugError) return reply.code(409).send({ error: err.message });
    if (err instanceof DuplicateNameError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}

export async function deleteProductHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  try {
    await deleteProduct(params.data.id);
    return reply.code(204).send();
  } catch (err) {
    if (err instanceof ProductHasOrdersError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}

export async function addVariantHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = createVariantSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const variant = await addVariant(params.data.id, parsed.data);
  return reply.code(201).send(variant);
}

export async function updateVariantHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = updateVariantSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const variant = await updateVariant(params.data.id, parsed.data);
  return reply.send(variant);
}
