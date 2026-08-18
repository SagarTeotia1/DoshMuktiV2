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
    <section className="bg-[#E6D3AE] border-b border-transparent py-3 sm:py-2.5">
      <StaggerGroup className="flex justify-start sm:justify-center flex-nowrap sm:flex-wrap gap-4 sm:gap-6 overflow-x-auto hide-scrollbar snap-x snap-mandatory max-w-7xl mx-auto pl-4 pr-4 sm:px-6 lg:px-12 pb-1 sm:pb-0 [scroll-padding-left:0.5rem]">
        {visible.map((item) => (
          <StaggerItem key={item.category} className="flex-shrink-0 snap-start [scroll-margin-left:0.5rem]">
            <Link
              href={`/shop?category=${encodeURIComponent(item.category)}`}
              className="group flex items-center gap-2"
            >
              <span className="relative w-14 h-14 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-[#2B1B0C] sm:border sm:border-[#2B1B0C]/40 shadow-neo-md sm:shadow-none group-hover:sm:border-[#9C5A26] transition-all duration-200 flex-shrink-0">
                <Image src={item.image!} alt={item.label} fill className="object-cover" sizes="56px" />
              </span>
              <span className="hidden sm:inline font-heading font-bold text-xs uppercase tracking-wide text-[#2B1B0C]/75 group-hover:text-[#9C5A26] transition-colors duration-300 whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
