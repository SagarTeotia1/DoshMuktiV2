'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';

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
  // Starts muted (required for the <video> tag to render without a play gesture),
  // but the first tap-to-play unmutes it — that tap is the user gesture browsers
  // require before allowing unmuted playback, so this is the earliest point sound
  // can turn on without an autoplay-with-sound block.
  const [muted, setMuted] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [buffering, setBuffering] = useState(false);
  // Hidden while playing so the button doesn't sit over the footage — tapping the
  // video re-shows it briefly (togglePlay bumps this true) before it fades out again.
  // Always shown while paused, since that's the only way back into playback.
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      return;
    }
    setShowControls(true);
    const timer = setTimeout(() => setShowControls(false), 1500);
    return () => clearTimeout(timer);
  }, [playing]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (!hasStarted) {
        v.muted = false;
        setMuted(false);
        setHasStarted(true);
      }
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

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v) return;
    const time = Number(e.target.value);
    v.currentTime = time;
    setCurrentTime(time);
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
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (!seeking) setCurrentTime(e.currentTarget.currentTime);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      />

      {/* Soft bottom gradient so overlay controls stay legible over any footage */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Buffering spinner — only while the network is stalled, never while genuinely paused */}
      {buffering && playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-8 h-8 text-[#E6D3AE] animate-spin" />
        </div>
      )}

      {/* Center play/pause — shown while paused (the only way back into playback) and
          briefly on tap while playing, then fades out so it doesn't sit over the footage.
          A soft pulsing ring while paused draws the eye to tap. */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {!playing && (
          <span className="absolute w-16 h-16 rounded-full bg-[#E6D3AE]/40 animate-ping" />
        )}
        <div className="relative w-16 h-16 rounded-full bg-[#E6D3AE]/95 backdrop-blur-sm border border-[#2B1B0C]/20 flex items-center justify-center shadow-neo-md transition-transform duration-200 ease-out group-hover:scale-110 active:scale-95">
          {playing ? (
            <Pause className="w-6 h-6 text-[#2B1B0C]" fill="currentColor" />
          ) : (
            <Play className="w-6 h-6 text-[#2B1B0C] ml-0.5" fill="currentColor" />
          )}
        </div>
      </div>

      {/* Mute toggle — bottom-right, raised above the seek bar, always reachable
          without pausing playback */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute bottom-8 right-3 w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/60 hover:scale-110 active:scale-95 transition-all duration-150"
      >
        {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>

      {/* Seek bar — flush along the bottom edge, stops propagation so dragging it
          never toggles play/pause via the container's click handler.
          Native <input type="range"> styling is unreliable across browsers (track
          height/color can render invisible), so the visible bar is a plain div pair
          (track + fill) and the range input sits on top, fully transparent, only to
          capture drag/click input. */}
      {duration > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 px-3 pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`relative w-full rounded-full bg-white/30 transition-all duration-150 ${
              seeking ? 'h-2.5' : 'h-1'
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-red-600"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              onPointerDown={() => setSeeking(true)}
              onPointerUp={() => setSeeking(false)}
              aria-label="Seek video"
              className="absolute -inset-y-2.5 left-0 w-full opacity-0 cursor-pointer m-0"
            />
          </div>
        </div>
      )}
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
      <h2 className="font-heading font-black text-base uppercase tracking-wide text-[#2B1B0C] mb-4 text-center">How to Use</h2>
      {player}
    </div>
  );
}
