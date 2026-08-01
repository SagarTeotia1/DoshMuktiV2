import type { FastifyRequest, FastifyReply } from 'fastify';
import { orderNumberParamSchema, listOrdersQuerySchema, updateOrderStatusSchema, idParamSchema } from './schema';
import { getOrderByNumber, getOrderById, listOrdersForAdmin, updateOrderStatus } from './service';

export async function trackOrderHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = orderNumberParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid order number' });

  const order = await getOrderByNumber(parsed.data.orderNumber);
  if (!order) return reply.code(404).send({ error: 'Order not found' });

  return reply.send(order);
}

export async function listOrdersHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listOrdersQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });

  return reply.send(await listOrdersForAdmin(parsed.data));
}

export async function getOrderByIdHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid id' });

  const order = await getOrderById(parsed.data.id);
  if (!order) return reply.code(404).send({ error: 'Order not found' });

  return reply.send(order);
}

export async function updateOrderStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const admin = (req.user as { sub: string }).sub;
  const order = await updateOrderStatus(id, parsed.data.status, parsed.data.note, admin);
  return reply.send(order);
}
