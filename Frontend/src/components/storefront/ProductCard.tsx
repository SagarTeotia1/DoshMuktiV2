'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Tag, ShoppingBag, Eye } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { formatCurrency } from '@/lib/formatters';
import { CardFrame } from './CardFrame';
import type { Product } from '@/types/api.types';

const MotionLink = motion.create(Link);

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { addItemAsync, isAdding } = useCart();
  const href = `/products/${product.slug}`;
  const prefetch = () => router.prefetch(href);
  const image = product.images[0]?.card ?? null;
  const hoverImage = product.images[1]?.card ?? null;
  const activeVariants = product.variants.filter((v) => v.isActive);
  const price =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map((v) => v.priceOverride ?? product.basePrice))
      : product.basePrice;
  const inStock = activeVariants.some((v) => v.stockQuantity > 0);

  const mrp = product.compareAtPrice && product.compareAtPrice > price ? product.compareAtPrice : null;
  const discountPct = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;

  async function quickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const variant = activeVariants.find((v) => v.stockQuantity > 0);
    if (!variant) return;
    try {
      await addItemAsync({ variantId: variant.id, quantity: 1 });
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart — try again');
    }
  }

  return (
    <MotionLink
      href={href}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
      className="neo-card group relative block h-full rounded-2xl flex flex-col bg-[#C49A6C] border border-[#2B1B0C]/8 shadow-neo-sm pt-3 pl-3 pr-4 pb-4 sm:pt-4 sm:pl-4 sm:pr-5 sm:pb-5"
      whileHover={{ y: -5, x: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <CardFrame />
      <div className="aspect-[4/5] bg-[#F6E4C2] rounded-xl relative overflow-hidden product-image-container border border-[#2B1B0C] shadow-[4px_4px_0_0_#2B1B0C]">
        {image ? (
          <>
            <Image
              src={image}
              alt={product.name}
              fill
              className={`object-cover transition-opacity duration-500 ${hoverImage ? 'group-hover:opacity-0' : 'group-hover:scale-[1.04] transition-transform duration-700'}`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={product.name}
                fill
                className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[#8A7A63] text-[10px] font-bold uppercase tracking-widest">No Image</span>
          </div>
        )}

        {/* Discount corner badge */}
        {discountPct ? (
          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10">
            <span className="sticker brutal-border flex items-center gap-1 bg-[#B23A2E] text-white pl-1.5 pr-2 py-0.5 sm:py-1 text-[8px] sm:text-[10px] font-bold font-body rounded-md shadow-[2px_2px_0_0_#2B1B0C] sm:shadow-[3px_3px_0_0_#2B1B0C] whitespace-nowrap">
              <Tag className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              {discountPct}% off
            </span>
          </div>
        ) : null}

        {!inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-20">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2B1B0C] border border-[#2B1B0C] bg-white px-2.5 py-1 rounded-full">
              Sold Out
            </span>
          </div>
        )}

        {/* Bestseller/badge — an ink-stamp seal on the photo itself, like a real product stamp.
            Lives on the image, never touches the name/price text below. */}
        {product.badge && (
          <span className="absolute bottom-2 right-2 z-10 -rotate-[8deg] px-2 py-1.5 rounded border-2 border-[#B23A2E]/80 bg-[#E6D3AE]/90 backdrop-blur-[1px] flex items-center justify-center shadow-[2px_3px_6px_rgba(43,27,12,0.35)]">
            <span className="absolute inset-[3px] rounded-sm border border-dashed border-[#B23A2E]/60" />
            <span className="relative text-[8px] sm:text-[9px] font-black font-body uppercase tracking-wide text-[#B23A2E]/90 text-center leading-[1.15] px-1">
              {product.badge}
            </span>
          </span>
        )}

        {/* Bottom action bar — desktop hover reveal only, hidden on touch so tap goes straight to the product page */}
        <div className="hidden sm:flex absolute inset-x-0 bottom-0 z-20 justify-center gap-2 p-2.5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-[#2B1B0C]/50 to-transparent">
          <span
            aria-label="View product"
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-neo-sm hover:bg-[#F6E4C2] transition-colors"
          >
            <Eye className="w-4 h-4 text-[#2B1B0C]" strokeWidth={1.75} />
          </span>
          {inStock && (
            <motion.button
              onClick={quickAdd}
              disabled={isAdding}
              aria-label="Quick add to cart"
              whileTap={{ scale: 0.85, rotate: -8 }}
              className="w-9 h-9 rounded-full bg-[#9C5A26] flex items-center justify-center shadow-neo-sm hover:bg-[#2B1B0C] transition-colors disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4 text-white" />
            </motion.button>
          )}
        </div>
      </div>

      <div className="pt-2.5 sm:pt-3 flex flex-col gap-1.5 flex-1">
        <h3 className="text-xs sm:text-sm font-bold text-[#2B1B0C] group-hover:text-[#6B3D19] transition-colors line-clamp-2 font-heading leading-snug tracking-tight min-h-[2.4em]">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-2 mt-auto pt-1">
          <p className="text-base sm:text-lg font-bold text-[#2B1B0C] font-heading tracking-tight tabular-nums">
            {formatCurrency(price)}
          </p>
          {mrp && <p className="text-xs text-[#8A7A63] line-through font-body tabular-nums">{formatCurrency(mrp)}</p>}
        </div>
      </div>
    </MotionLink>
  );
}
