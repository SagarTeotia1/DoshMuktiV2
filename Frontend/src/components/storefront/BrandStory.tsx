import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { MandalaMotif } from '@/components/motion/MandalaMotif';

export interface StoryImage {
  src: string;
  alt: string;
}

// Site theme: #2B1B0C dark brown · #9C5A26 bronze · #C9863F light bronze · #E6D3AE sand/cream

/** Thin bronze rule with a small diamond centre. */
function Ornament({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-[#C9863F]/70" />
      <svg width="9" height="9" viewBox="0 0 10 10" fill="#C9863F">
        <path d="M5 0l5 5-5 5-5-5z" />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-[#C9863F]/70" />
    </div>
  );
}

/**
 * Photo composition: a tall arch (main), a framed print overlapping its lower right,
 * and a round medallion at the lower left. An offset outline arch sits behind the main photo.
 */
function Composition({ main, print, medal }: { main: StoryImage; print?: StoryImage; medal?: StoryImage }) {
  return (
    <div className="relative mx-auto aspect-[1/1.08] w-full max-w-[24rem] sm:max-w-md lg:max-w-none">
      {/* warm glow behind the cluster */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: 'rgba(201,134,63,0.22)' }}
        aria-hidden
      />

      {/* BACK — large arch, offset outline arch behind it */}
      <div className="absolute left-0 top-0 h-[78%] w-[60%] rounded-t-full border border-[#C9863F]/60" aria-hidden />
      <div className="absolute left-2.5 top-2.5 z-10 h-[78%] w-[60%] overflow-hidden rounded-t-full border border-[#9C5A26]/60 bg-[#3A2612] shadow-[0_18px_40px_rgba(0,0,0,0.5)] sm:left-3 sm:top-3">
        <Image src={main.src} alt={main.alt} fill sizes="(min-width: 1024px) 22rem, 62vw" className="object-cover" />
      </div>

      {/* FRONT — large framed print overlapping the arch's right edge */}
      {print && (
        <div className="absolute right-0 top-[16%] z-20 w-[50%] border border-[#C9863F] bg-[#2B1B0C] p-1 shadow-[0_20px_45px_rgba(0,0,0,0.6)] sm:p-1.5">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#3A2612]">
            <Image src={print.src} alt={print.alt} fill sizes="(min-width: 1024px) 18rem, 48vw" className="object-cover" />
          </div>
        </div>
      )}

      {/* FRONT-MOST — smaller medallion tucked where arch and print meet */}
      {medal && (
        <div className="absolute bottom-0 left-[16%] z-30 aspect-square w-[36%] overflow-hidden rounded-full border-2 border-[#C9863F] bg-[#2B1B0C] p-[3px] shadow-[0_14px_32px_rgba(0,0,0,0.6)]">
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <Image src={medal.src} alt={medal.alt} fill sizes="10rem" className="object-cover" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Brand story — photo composition left, story right (stacked on mobile).
 * `embedded`: product page — breaks out of the page's side padding (negative margins) so it
 * runs edge to edge, with the same section spacing as its neighbours.
 */
export function BrandStory({ images = [], embedded = false }: { images?: StoryImage[]; embedded?: boolean }) {
  const [main, print, medal] = images;

  return (
    <section
      className={`relative overflow-hidden bg-[#2B1B0C] text-[#E6D3AE] ${
        embedded
          ? '-mx-4 mt-10 py-14 sm:-mx-6 sm:mt-14 sm:py-20 lg:-mx-12'
          : 'py-12 sm:py-20'
      }`}
    >
      <MandalaMotif className="pointer-events-none absolute -right-32 top-1/2 h-[36rem] w-[36rem] -translate-y-1/2 text-[#C9863F]/[0.07]" />
      {/* Soft fade from the page's sand colour into the dark band, so it blends instead of cutting in. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#E6D3AE] via-[#E6D3AE]/40 to-transparent sm:h-12"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#E6D3AE] via-[#E6D3AE]/40 to-transparent sm:h-14"
        aria-hidden
      />

      {/* Mobile order: "Our story" → photos → headline → story. Desktop: photos left (full height), text right. */}
      <div className="relative mx-auto grid max-w-6xl gap-x-20 gap-y-7 px-6 lg:grid-cols-[1fr_1.05fr] lg:grid-rows-[auto_auto_auto] lg:content-start lg:gap-y-5 lg:px-12">
        <Reveal className="text-center lg:col-start-2 lg:row-start-1 lg:text-left">
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#C9863F]/80" aria-hidden />
            <h2 className="font-heading text-3xl font-black uppercase leading-none tracking-tighter text-[#E6D3AE] sm:text-4xl">
              Our Story
            </h2>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#C9863F]/80" aria-hidden />
          </div>
        </Reveal>

        <Reveal className="lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:self-start">
          {main && <Composition main={main} print={print} medal={medal} />}
        </Reveal>

        <Reveal className="text-center lg:col-start-2 lg:row-start-2 lg:text-left">
          <h3 className="font-heading text-[1.6rem] font-extrabold leading-[1.2] tracking-tight sm:text-[2rem]">
            <span className="text-[#E8A850]">Authentic Verified Stones</span> and Siddh Remedies, trusted by{' '}
            <span className="text-[#E8A850]">1800+ families</span> across India
          </h3>
          <Ornament className="mt-5 justify-center lg:justify-start" />
        </Reveal>

        <Reveal className="text-center lg:col-start-2 lg:row-start-3 lg:text-left">
          <div className="space-y-4 font-body text-[15px] leading-[1.8] text-[#E6D3AE]/85 sm:text-base">
            <p className="text-lg font-medium leading-snug text-[#E6D3AE] sm:text-xl">
              When you wear a stone for your fortune, you are placing your faith in whoever sold it. We take that
              seriously.
            </p>
            <p>
              Every stone at <strong className="font-semibold text-[#E6D3AE]">Doshmukti</strong> is verified before we
              list it. Every remedy is prepared the Siddh way. Every order is packed by our own team and shipped insured,
              with tracking, anywhere in India.
            </p>
            <p>
              That is why 1800+ families keep coming back to us. And if anything is not exactly as promised, you can
              return it within 7 days.
            </p>
          </div>

          <dl className="mx-auto mt-8 grid max-w-sm grid-cols-3 text-center lg:mx-0 lg:text-left">
            {[
              ['1800+', 'happy customers'],
              ['4.8', 'average rating'],
              ['7 days', 'easy returns'],
            ].map(([value, label], i) => (
              <div key={label} className={i > 0 ? 'border-l border-[#9C5A26]/50 pl-4' : 'pr-4'}>
                <dt className="font-heading text-2xl font-bold text-[#C9863F] sm:text-3xl">{value}</dt>
                <dd className="mt-0.5 font-body text-[11px] text-[#B8A98A] sm:text-xs">{label}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/shop"
            className="mt-9 inline-flex items-center justify-center border border-[#C9863F] px-8 py-3.5 font-body text-xs tracking-[0.16em] text-[#E6D3AE] transition-colors hover:bg-[#C9863F] hover:text-[#2B1B0C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9863F]"
          >
            SHOP THE COLLECTION
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
