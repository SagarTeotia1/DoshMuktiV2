import type { FastifyRequest, FastifyReply } from 'fastify';
import { orderNumberParamSchema, phoneQuerySchema, listOrdersQuerySchema, updateOrderStatusSchema, idParamSchema, gstReportQuerySchema } from './schema';
import {
  getOrderByNumber,
  listOrdersByPhone,
  listOrdersForUser,
  getOrderById,
  listOrdersForAdmin,
  updateOrderStatus,
  getGstReport,
  type GstReportOrderRow,
} from './service';
import { generateInvoicePdf } from './invoice';

export async function trackOrderHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = orderNumberParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid order number' });

  const order = await getOrderByNumber(parsed.data.orderNumber);
  if (!order) return reply.code(404).send({ error: 'Order not found' });

  return reply.send(order);
}

export async function invoiceHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = orderNumberParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid order number' });

  const order = await getOrderByNumber(parsed.data.orderNumber);
  if (!order) return reply.code(404).send({ error: 'Order not found' });

  if (order.payment?.status !== 'CAPTURED') {
    return reply.code(409).send({ error: 'Invoice not available until payment is confirmed' });
  }

  const pdfBuffer = await generateInvoicePdf(order);

  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`)
    .send(pdfBuffer);
}

export async function listMyOrdersHandler(req: FastifyRequest, reply: FastifyReply) {
  const userId = (req.user as { sub: string }).sub;
  return reply.send(await listOrdersForUser(userId));
}

export async function listOrdersByPhoneHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = phoneQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Enter a valid 10-digit phone number' });

  return reply.send(await listOrdersByPhone(parsed.data.phone));
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

function rowsToCsv(rows: GstReportOrderRow[]): string {
  const header = ['Order Number', 'Order Date', 'SKU', 'Product', 'Qty', 'GST Rate %', 'Line Total', 'Taxable Value', 'GST Amount'];
  const lines = [header.join(',')];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  for (const order of rows) {
    for (const item of order.items) {
      lines.push(
        [
          esc(order.orderNumber),
          esc(order.orderDate),
          esc(item.sku),
          esc(item.productName),
          String(item.quantity),
          item.gstRate.toFixed(2),
          item.lineTotal.toFixed(2),
          item.taxableValue.toFixed(2),
          item.gstAmount.toFixed(2),
        ].join(',')
      );
    }
  }
  return lines.join('\n');
}

export async function gstReportHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = gstReportQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });

  const report = await getGstReport(parsed.data.from, parsed.data.to);

  if (parsed.data.format === 'csv') {
    const csv = rowsToCsv(report.orders);
    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="gst-report-${report.from}_to_${report.to}.csv"`)
      .send(csv);
  }

  return reply.send(report);
}

export async function updateOrderStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const admin = (req.user as { sub: string }).sub;
  const order = await updateOrderStatus(id, parsed.data.status, parsed.data.note, admin);
  return reply.send(order);
}
