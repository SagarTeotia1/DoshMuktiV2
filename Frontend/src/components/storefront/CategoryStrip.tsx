import Link from 'next/link';
import Image from 'next/image';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

export interface CategoryThumb {
  label: string;
  category: string;
  image: string | null;
}

export function CategoryStrip({ items }: { items: CategoryThumb[] }) {
  const visible = items.filter((i) => i.image);
  if (visible.length === 0) return null;

  return (
    <section className="bg-[#FBF1DF] border-b border-[#2B1B0C]/10 py-2 sm:py-2.5">
      <StaggerGroup className="flex justify-start sm:justify-center flex-nowrap sm:flex-wrap gap-4 sm:gap-6 overflow-x-auto hide-scrollbar snap-x snap-mandatory max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        {visible.map((item) => (
          <StaggerItem key={item.category} className="flex-shrink-0 snap-start">
            <Link
              href={`/shop?category=${encodeURIComponent(item.category)}`}
              className="group flex items-center gap-2"
            >
              <span className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-[#2B1B0C]/40 group-hover:border-[#9C5A26] transition-colors duration-300 flex-shrink-0">
                <Image src={item.image!} alt="" fill className="object-cover" sizes="40px" />
              </span>
              <span className="font-heading font-bold text-[11px] sm:text-xs uppercase tracking-wide text-[#2B1B0C]/75 group-hover:text-[#9C5A26] transition-colors duration-300 whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
