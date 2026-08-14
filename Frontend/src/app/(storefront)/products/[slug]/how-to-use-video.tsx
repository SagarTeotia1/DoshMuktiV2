'use client';

import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

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

// Direct-file uploads on this product page are always vertical 9:16 phone-shot
// how-to-wear clips — box fixed to that ratio up front, no orientation detection,
// no flash of a wrong box. object-cover fills it edge-to-edge cleanly since the
// source already matches the box ratio.
function DirectVideoPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  return (
    <div
      className="group relative aspect-[9/16] max-w-[300px] mx-auto rounded-2xl overflow-hidden border border-[#2B1B0C] shadow-neo-md bg-[#2B1B0C] cursor-pointer"
      onClick={togglePlay}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={url}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Soft bottom gradient so overlay controls stay legible over any footage */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Center play/pause — visible at rest, fades on play, always reappears on hover/tap */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
          playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="w-16 h-16 rounded-full bg-[#FBF1DF]/90 backdrop-blur-sm border border-[#2B1B0C]/20 flex items-center justify-center shadow-neo-md">
          {playing ? (
            <Pause className="w-6 h-6 text-[#2B1B0C]" fill="currentColor" />
          ) : (
            <Play className="w-6 h-6 text-[#2B1B0C] ml-0.5" fill="currentColor" />
          )}
        </div>
      </div>

      {/* Mute toggle — bottom-right, always reachable without pausing playback */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/60 transition-colors"
      >
        {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>
    </div>
  );
}

export function HowToUseVideo({ url, bare = false }: { url: string | null; bare?: boolean }) {
  if (!url) return null;
  const embedUrl = toEmbedUrl(url);

  const player = embedUrl ? (
    <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2B1B0C] shadow-neo-md bg-[#2B1B0C]">
      <iframe
        src={embedUrl}
        title="How to use"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  ) : (
    <DirectVideoPlayer url={url} />
  );

  if (bare) return player;

  return (
    <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
      <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4">How to Use</h2>
      {player}
    </div>
  );
}
