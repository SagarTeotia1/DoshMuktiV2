import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Accordion } from '@/components/storefront/Accordion';
import { AddToCart } from './add-to-cart';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

interface ProductDetailResponse {
  product: Product;
  related: Product[];
}

async function getProduct(slug: string): Promise<ProductDetailResponse | null> {
  try {
    return await api.get<ProductDetailResponse>(`/api/products/${slug}`);
  } catch {
    return null;
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();

  const { product, related } = data;
  const image = product.images[0]?.full ?? null;
  const price = product.variants[0]?.priceOverride ?? product.basePrice;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        <div className="aspect-square bg-[#F6E4C2] border border-[#2B1B0C] rounded-2xl relative overflow-hidden">
          {image ? (
            <Image src={image} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#8A7A63] text-xs font-bold uppercase tracking-widest">
              No Image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <span className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26]">{product.category}</span>
          <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#2B1B0C]">{product.name}</h1>

          {product.purpose.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.purpose.map((p) => (
                <span key={p} className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 border border-[#2B1B0C]/15 text-[#6B5539] rounded-full font-body">
                  {p}
                </span>
              ))}
            </div>
          )}

          <p className="font-heading text-2xl sm:text-3xl font-bold text-[#2B1B0C]">{formatCurrency(price)}</p>

          {product.socialProofText && (
            <p className="font-body text-xs font-bold uppercase tracking-wider text-[#9C5A26]">{product.socialProofText}</p>
          )}

          <p className="font-body text-sm text-[#6B5539] leading-relaxed">{product.description}</p>

          <AddToCart product={product} />

          {product.benefits.length > 0 && (
            <div className="mt-2">
              <h2 className="font-heading text-lg font-bold text-[#2B1B0C] mb-2">Benefits</h2>
              <ol className="flex flex-col gap-2">
                {product.benefits.map((b, i) => (
                  <li key={i} className="font-body text-sm text-[#6B5539] leading-relaxed">
                    <span className="font-bold text-[#2B1B0C]">{i + 1}. {b.title}</span> — {b.description}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {product.howToWear.length > 0 && (
            <div className="mt-2">
              <h2 className="font-heading text-lg font-bold text-[#2B1B0C] mb-2">How to wear?</h2>
              <ol className="flex flex-col gap-1.5">
                {product.howToWear.map((step, i) => (
                  <li key={i} className="font-body text-sm text-[#6B5539] leading-relaxed">
                    {i + 1}. {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {product.careInstructions && (
            <div className="mt-2">
              <h2 className="font-heading text-lg font-bold text-[#2B1B0C] mb-2">Care Instructions</h2>
              <p className="font-body text-sm text-[#6B5539] leading-relaxed">{product.careInstructions}</p>
            </div>
          )}

          <div className="mt-4 border-t border-[#2B1B0C]/10 pt-2">
            <Accordion
              sections={[
                {
                  title: 'Delivery & Shipping',
                  content: 'Orders are dispatched within 24-48 hours and typically arrive within 5-7 business days across India.',
                },
                {
                  title: 'Returns & Replacement',
                  content: 'Damaged or incorrect items can be reported within 48 hours of delivery for a free replacement.',
                },
                {
                  title: 'Cashback Policy',
                  content: 'Cashback, where applicable, is credited to your account within 7 days of order delivery.',
                },
                {
                  title: 'Need Help?',
                  content: 'Chat with us Mon to Sat, 10 AM to 5 PM, via the support widget or WhatsApp.',
                },
              ]}
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 sm:mt-24">
          <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tighter uppercase text-[#2B1B0C] mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
