// Meta (Facebook/Instagram) commerce catalog feed — built live from Product/ProductVariant
// on every request rather than a file written to disk. Cloud Run instances are ephemeral and
// don't share a filesystem, so a CSV written at runtime would vanish on the next deploy/restart
// and wouldn't be visible to other instances anyway. Meta's Commerce Manager instead re-fetches
// a stable feed URL on its own schedule (see catalog/routes.ts) — that's what keeps this "self
// populating" without anyone re-running an export.
import { db } from '../../shared/db/client';
import type { DescriptionBlock } from '../products/schema';

const SITE_URL = 'https://doshmukti.com';
const BRAND = 'Doshmukti';

const HEADER = [
  'id', 'title', 'description', 'availability', 'condition', 'link', 'image_link', 'brand',
  'price', 'google_product_category', 'fb_product_category', 'quantity_to_sell_on_facebook',
  'sale_price', 'sale_price_effective_date', 'item_group_id', 'gender', 'color', 'size',
  'age_group', 'material', 'pattern', 'shipping', 'shipping_weight', 'offer_disclaimer',
  'offer_disclaimer_url', 'video[0].url', 'video[0].tag[0]', 'gtin', 'product_tags[0]',
  'product_tags[1]', 'style[0]',
];

function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function extractDescription(description: unknown): string {
  const blocks = Array.isArray(description) ? (description as DescriptionBlock[]) : [];
  const text = blocks
    .filter((b): b is Extract<DescriptionBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.content.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 9999 ? `${text.slice(0, 9996)}...` : text;
}

function mainImage(images: unknown): string {
  const arr = Array.isArray(images) ? (images as Array<{ full?: string; card?: string }>) : [];
  return arr[0]?.full ?? arr[0]?.card ?? '';
}

function money(n: number): string {
  return `${n.toFixed(2)} INR`;
}

export async function buildCatalogCsv(): Promise<string> {
  const products = await db.product.findMany({
    where: { status: 'ACTIVE' },
    include: { variants: { where: { isActive: true } } },
    orderBy: { name: 'asc' },
  });

  const rows: string[] = [HEADER.join(',')];

  for (const product of products) {
    if (product.variants.length === 0) continue;

    const hasMultipleVariants = product.variants.length > 1;
    const basePrice = Number(product.basePrice);
    const compareAtPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
    const description = extractDescription(product.description);
    const image = mainImage(product.images);
    const link = `${SITE_URL}/products/${product.slug}`;

    for (const variant of product.variants) {
      const attrs = (variant.attributes ?? {}) as Record<string, string>;
      const variantLabel = Object.values(attrs).filter(Boolean).join(' / ');
      const title = hasMultipleVariants && variantLabel ? `${product.name} - ${variantLabel}` : product.name;

      const effectivePrice = variant.priceOverride ? Number(variant.priceOverride) : basePrice;
      const price = compareAtPrice && compareAtPrice > effectivePrice ? compareAtPrice : effectivePrice;
      const salePrice = compareAtPrice && compareAtPrice > effectivePrice ? effectivePrice : null;

      const row = [
        variant.sku,
        title,
        description,
        variant.stockQuantity > 0 ? 'in stock' : 'out of stock',
        'new',
        link,
        image,
        BRAND,
        money(price),
        '',
        '',
        String(variant.stockQuantity),
        salePrice !== null ? money(salePrice) : '',
        '',
        product.id,
        'unisex',
        attrs.color ?? '',
        attrs.size ?? '',
        'adult',
        attrs.material ?? '',
        '',
        '',
        `${(variant.weight / 1000).toFixed(3)} kg`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ].map(csvField);

      rows.push(row.join(','));
    }
  }

  return rows.join('\r\n');
}
