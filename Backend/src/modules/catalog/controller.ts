import type { FastifyRequest, FastifyReply } from 'fastify';
import { setPublicCache } from '../../shared/http/cacheControl';
import { buildCatalogCsv } from './service';

export async function getCatalogFeedHandler(_req: FastifyRequest, reply: FastifyReply) {
  const csv = await buildCatalogCsv();
  setPublicCache(reply, 1800); // Meta re-fetches on its own schedule; this just saves a rebuild on rapid repeat hits
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', 'inline; filename="catalog_products.csv"');
  return reply.send(csv);
}
