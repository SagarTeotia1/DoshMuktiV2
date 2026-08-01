import type { FastifyRequest, FastifyReply } from 'fastify';
import { adjustStockSchema } from './schema';
import { getInventoryForAdmin, adjustStock, importStockFromCsv, exportInventoryCsv } from './service';

export async function listInventoryHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getInventoryForAdmin());
}

export async function adjustStockHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = adjustStockSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const admin = (req.user as { sub: string }).sub;
  await adjustStock({ ...parsed.data, createdBy: admin });
  return reply.code(204).send();
}

export async function exportInventoryHandler(_req: FastifyRequest, reply: FastifyReply) {
  const csv = await exportInventoryCsv();
  reply.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename="inventory.csv"');
  return reply.send(csv);
}

export async function importStockHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as { rows: Array<{ sku: string; newQuantity: number }> };
  if (!Array.isArray(body.rows)) return reply.code(400).send({ error: 'Invalid CSV payload' });

  const admin = (req.user as { sub: string }).sub;
  const results = await importStockFromCsv(body.rows, admin);
  return reply.send({ results });
}
