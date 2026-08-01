import { db } from '../../shared/db/client';
import { invalidateProductCaches } from '../products/service';

export async function getInventoryForAdmin() {
  return db.product.findMany({
    where: { status: { not: 'ARCHIVED' } },
    include: { variants: true },
    orderBy: { name: 'asc' },
  });
}

// StockMovement is append-only — never UPDATE or DELETE a movement row.
export async function adjustStock(params: { variantId: string; newQuantity: number; note?: string; createdBy: string }) {
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { id: params.variantId },
    select: { stockQuantity: true },
  });
  const delta = params.newQuantity - variant.stockQuantity;

  await db.$transaction([
    db.productVariant.update({ where: { id: params.variantId }, data: { stockQuantity: params.newQuantity } }),
    db.stockMovement.create({
      data: { variantId: params.variantId, change: delta, reason: 'MANUAL_ADJUSTMENT', note: params.note, createdBy: params.createdBy },
    }),
  ]);

  await invalidateProductCaches();
}

export async function exportInventoryCsv(): Promise<string> {
  const variants = await db.productVariant.findMany({
    where: { isActive: true },
    include: { product: { select: { name: true } } },
    orderBy: { sku: 'asc' },
  });

  const header = 'sku,productName,attributes,stockQuantity,lowStockThreshold\n';
  const rows = variants
    .map((v) => {
      const attrs = JSON.stringify(v.attributes).replace(/"/g, '""');
      return `${v.sku},"${v.product.name}","${attrs}",${v.stockQuantity},${v.lowStockThreshold}`;
    })
    .join('\n');

  return header + rows;
}

export async function importStockFromCsv(rows: Array<{ sku: string; newQuantity: number }>, createdBy: string) {
  const results: Array<{ sku: string; ok: boolean; error?: string }> = [];

  for (const row of rows) {
    const variant = await db.productVariant.findUnique({ where: { sku: row.sku } });
    if (!variant) {
      results.push({ sku: row.sku, ok: false, error: 'Unknown SKU' });
      continue;
    }
    await adjustStock({ variantId: variant.id, newQuantity: row.newQuantity, note: 'CSV import', createdBy });
    results.push({ sku: row.sku, ok: true });
  }

  return results;
}
