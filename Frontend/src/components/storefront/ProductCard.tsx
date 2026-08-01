import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

const PURPOSE_LABELS: Record<string, string> = {
  love: 'Love',
  wealth: 'Wealth',
  health: 'Health',
  success: 'Success',
  protection: 'Protection',
  clarity: 'Clarity',
};

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0]?.card ?? null;
  const activeVariants = product.variants.filter((v) => v.isActive);
  const price =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map((v) => v.priceOverride ?? product.basePrice))
      : product.basePrice;
  const inStock = activeVariants.some((v) => v.stockQuantity > 0);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block neo-card gold-shimmer bg-white border border-[#2B1B0C] rounded-2xl overflow-hidden flex flex-col"
    >
      <div className="aspect-[4/5] border-b border-[#2B1B0C] bg-[#F6E4C2] relative overflow-hidden product-image-container">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[#8A7A63] text-[10px] font-bold uppercase tracking-widest">No Image</span>
          </div>
        )}

        {product.badge && (
          <span className="absolute top-2.5 left-2.5 bg-[#9C5A26] text-[#2B1B0C] border border-[#2B1B0C] px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider z-10 rounded-full">
            {product.badge}
          </span>
        )}

        {!inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2B1B0C] border border-[#2B1B0C] bg-white px-2.5 py-1 rounded-full">
              Sold Out
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-[#2B1B0C]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white border border-white/40 px-4 py-2 rounded-full hover:bg-white hover:text-[#2B1B0C] transition-colors duration-200">
            View Product
          </span>
        </div>
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1">
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-[#9C5A26] font-body">{product.category}</span>
        <h3 className="text-xs sm:text-sm font-semibold text-[#2B1B0C] group-hover:text-[#6B3D19] transition-colors line-clamp-2 font-heading leading-snug">
          {product.name}
        </h3>

        {product.purpose.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {product.purpose.slice(0, 2).map((p) => (
              <span key={p} className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-[#2B1B0C]/15 text-[#6B5539] font-body rounded-full">
                {PURPOSE_LABELS[p] ?? p}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm sm:text-base font-bold text-[#2B1B0C] font-heading mt-auto pt-1">{formatCurrency(price)}</p>
      </div>
    </Link>
  );
}
