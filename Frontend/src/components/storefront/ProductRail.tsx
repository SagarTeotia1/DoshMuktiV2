import { ProductCard } from './ProductCard';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';
import { BlobMotif } from '@/components/motion/BlobMotif';
import type { Product } from '@/types/api.types';

function RailHeader({ eyebrow, title, centered }: { eyebrow?: string; title: string; centered?: boolean }) {
  if (centered) {
    return (
      <div className="text-center mb-3 sm:mb-4">
        <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl tracking-tight text-[#2B1B0C] leading-[1.05]">
          <span className="font-black">{title.split(' ')[0]}</span>{' '}
          <span className="font-light italic text-[#9C5A26]">{title.split(' ').slice(1).join(' ')}</span>
        </h2>
      </div>
    );
  }

  return (
    <div className="mb-8 sm:mb-12">
      <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl tracking-tight text-[#2B1B0C] leading-[1.05]">
        {eyebrow && <span className="font-black">{eyebrow}</span>}
        {eyebrow && <span className="font-light italic text-[#9C5A26]"> — </span>}
        <span className={eyebrow ? 'font-light italic text-[#9C5A26]' : 'font-black uppercase tracking-tighter'}>
          {title}
        </span>
      </h2>
    </div>
  );
}

export function ProductRail({
  eyebrow,
  title,
  products,
  tinted,
  tightTop,
  tightBottom,
  centered,
  blobVariant = 'a',
}: {
  eyebrow?: string;
  title: string;
  products: Product[];
  tinted?: boolean;
  /** Cuts top padding — use when the previous section already provides enough breathing room. */
  tightTop?: boolean;
  /** Cuts bottom padding — use when the next section already provides enough breathing room. */
  tightBottom?: boolean;
  /** Centers the header block, title-first — for a rail standing alone without an eyebrow. */
  centered?: boolean;
  /** Which blob path to use for the corner decoration on tinted rails — alternate so adjacent tinted sections don't repeat. */
  blobVariant?: 'a' | 'b';
}) {
  if (products.length === 0) return null;

  return (
    <section
      className={`relative overflow-hidden ${tightTop ? 'pt-6 sm:pt-8' : 'pt-10 sm:pt-14 md:pt-20'} ${tightBottom ? 'pb-6 sm:pb-8' : 'pb-10 sm:pb-14 md:pb-20'} ${tinted ? 'bg-[#F6E4C2]/50' : ''}`}
    >
      {tinted && (
        <BlobMotif
          variant={blobVariant}
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 text-[#9C5A26]/[0.07] rotate-12"
        />
      )}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <Reveal>
          <RailHeader eyebrow={eyebrow} title={title} centered={centered} />
        </Reveal>
      </div>
      <StaggerGroup className="flex gap-5 sm:gap-6 overflow-x-auto hide-scrollbar snap-x snap-mandatory py-2 px-4 sm:px-5">
        {products.map((product) => (
          <StaggerItem key={product.id} className="flex-shrink-0 snap-start w-[45vw] sm:w-[220px] md:w-[240px]">
            <ProductCard product={product} />
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
