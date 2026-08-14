'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Eye, Heart, Send, ShoppingBag, Volume2, VolumeX, X } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { formatCurrency } from '@/lib/formatters';
import type { Product, TestimonialVideo } from '@/types/api.types';

export type { TestimonialVideo };

// `autoPlay` on the element is enough in most browsers, but a few (notably Safari,
// and Chrome right after a fast-refresh/hydration swap) only honor it if `.play()`
// is also called explicitly once mounted — belt and suspenders so it never sits on
// the poster frame waiting for a tap that shouldn't be required.
function useAutoplay(muted: boolean) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    ref.current?.play().catch(() => {});
  }, [muted]);
  return ref;
}

function TestimonialCard({ video, onOpen }: { video: TestimonialVideo; onOpen: () => void }) {
  const videoRef = useAutoplay(true);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex-shrink-0 w-[150px] sm:w-[170px] aspect-[9/16] rounded-xl overflow-hidden border border-[#2B1B0C] shadow-neo-md bg-[#2B1B0C] text-left"
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        poster={video.posterUrl ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
        <Eye className="w-3 h-3 text-white" />
        <span className="font-body text-[10px] font-semibold text-white">{video.views}</span>
      </div>
      {video.caption && (
        <p className="absolute bottom-2 left-2 right-2 font-body text-[11px] font-semibold text-white leading-tight line-clamp-2">
          {video.caption}
        </p>
      )}
    </button>
  );
}

function TestimonialModal({
  video,
  product,
  price,
  onClose,
}: {
  video: TestimonialVideo;
  product: Product;
  price: number;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const videoRef = useAutoplay(muted);
  const { addItemAsync, isAdding } = useCart();
  const activeVariants = product.variants.filter((v) => v.isActive && v.attributes.type !== 'service');

  async function handleAddToCart() {
    const variant = activeVariants[0];
    if (!variant) {
      toast.error('This product is currently unavailable');
      return;
    }
    try {
      await addItemAsync({ variantId: variant.id, quantity: 1 });
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart — try again');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md aspect-[9/16] rounded-xl overflow-hidden border border-white/10 bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.posterUrl ?? undefined}
          autoPlay
          muted={muted}
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Like/share stack — right edge, astrotalk-style engagement rail */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setLiked((l) => !l)}
            aria-label={liked ? 'Unlike' : 'Like'}
            className="flex flex-col items-center gap-1"
          >
            <Heart className={`w-6 h-6 drop-shadow ${liked ? 'fill-[#B23A2E] text-[#B23A2E]' : 'text-white'}`} />
            <span className="font-body text-[10px] font-semibold text-white drop-shadow">{video.views}</span>
          </button>
          <button type="button" aria-label="Share" className="flex flex-col items-center gap-1">
            <Send className="w-5 h-5 text-white drop-shadow" />
          </button>
        </div>

        {/* Mute toggle — top-left, direct user gesture so unmuting here is safe */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Bottom product strip */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-10 pb-3 px-3">
          <div className="flex items-center gap-3">
            {product.images[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.images[0].thumb}
                alt=""
                className="w-11 h-11 rounded-lg object-cover border border-white/20 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs font-semibold text-white truncate">{product.name}</p>
              <p className="font-heading text-sm font-black text-white tabular-nums">{formatCurrency(price)}</p>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAdding}
              className="flex items-center gap-1.5 bg-[#B23A2E] text-white rounded-lg px-3 py-2 font-body font-bold uppercase tracking-wide text-[11px] hover:bg-[#9C2E24] transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {isAdding ? 'Adding...' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestimonialVideos({
  videos,
  product,
  price,
}: {
  videos: TestimonialVideo[];
  product: Product;
  price: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openVideo = videos.find((v) => v.id === openId) ?? null;

  if (videos.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="font-heading font-bold text-xs uppercase tracking-wide text-[#2B1B0C] mb-3">
        {product.socialProofText || 'Loved by our customers'}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {videos.map((video) => (
          <TestimonialCard key={video.id} video={video} onOpen={() => setOpenId(video.id)} />
        ))}
      </div>

      {openVideo && <TestimonialModal video={openVideo} product={product} price={price} onClose={() => setOpenId(null)} />}
    </div>
  );
}
