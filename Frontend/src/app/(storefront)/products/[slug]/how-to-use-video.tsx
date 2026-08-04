function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  // youtube-nocookie.com (privacy-enhanced mode) — the regular youtube.com embed domain
  // triggers error 153 ("failed to load, playback error") under Safari's tracking
  // prevention, since it blocks the third-party storage access the normal embed needs.
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function HowToUseVideo({ url, bare = false }: { url: string | null; bare?: boolean }) {
  if (!url) return null;
  const embedUrl = toEmbedUrl(url);

  const player = (
    <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2B1B0C] shadow-neo-md bg-[#2B1B0C]">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title="How to use"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls className="absolute inset-0 w-full h-full object-cover" />
      )}
    </div>
  );

  if (bare) return player;

  return (
    <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
      <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4">How to Use</h2>
      {player}
    </div>
  );
}
