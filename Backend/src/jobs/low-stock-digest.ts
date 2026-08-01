import { db } from '../shared/db/client';
import { resend } from '../shared/integrations/resend/client';
import { env } from '../config/env';

interface LowStockRow {
  id: string;
  sku: string;
  stockQuantity: number;
  productName: string;
}

export async function sendLowStockDigest(): Promise<{ variantsFlagged: number }> {
  // Prisma can't compare two columns in `where` — raw query needed to check
  // stockQuantity against each variant's own lowStockThreshold.
  const lowStock = await db.$queryRaw<LowStockRow[]>`
    SELECT v.id, v.sku, v."stockQuantity", p.name AS "productName"
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    WHERE v."isActive" = true AND v."stockQuantity" <= v."lowStockThreshold"
  `;

  if (lowStock.length === 0 || !resend) return { variantsFlagged: lowStock.length };

  const rows = lowStock.map((v) => `<tr><td>${v.productName}</td><td>${v.sku}</td><td>${v.stockQuantity}</td></tr>`).join('');
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: env.ADMIN_EMAIL,
    subject: `Low Stock Digest — ${lowStock.length} variant(s) below threshold`,
    html: `<table><tr><th>Product</th><th>SKU</th><th>Stock</th></tr>${rows}</table>`,
  });

  return { variantsFlagged: lowStock.length };
}
