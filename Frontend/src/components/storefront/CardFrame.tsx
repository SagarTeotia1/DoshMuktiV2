/**
 * Ornamental corner frame overlaid on product cards — layered bronze
 * temple-bracket with a mala bead and a wordmark-style sparkle, echoing
 * the logo's mala-bead curl and star accents. Pure decoration: absolute,
 * pointer-events-none, one shape mirrored into all 4 corners so
 * proportions stay true on non-square cards.
 */
function Corner({ className }: { className: string }) {
  return (
    <svg
      className={`absolute w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 ${className}`}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cardFrameGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9863F" />
          <stop offset="100%" stopColor="#6B3D19" />
        </linearGradient>
      </defs>

      {/* outer bracket */}
      <path
        d="M3 24 L3 11 Q3 3 11 3 L24 3"
        stroke="url(#cardFrameGrad)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* inner echo line */}
      <path
        d="M8 24 L8 15 Q8 8 15 8 L24 8"
        stroke="#9C5A26"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* mala bead at the joint */}
      <circle cx="8" cy="8" r="2.2" fill="url(#cardFrameGrad)" />
      <circle cx="8" cy="8" r="0.9" fill="#F6E4C2" opacity="0.7" />

      {/* trailing curl, like the logo's tassel swing */}
      <path
        d="M13.5 8.5 q4 -4.5 8.5 -1"
        stroke="#9C5A26"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* sparkle accent */}
      <path
        d="M27 13 L27.9 15.6 L30.5 16.5 L27.9 17.4 L27 20 L26.1 17.4 L23.5 16.5 L26.1 15.6 Z"
        fill="#9C5A26"
        opacity="0.75"
      />
    </svg>
  );
}

export function CardFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-75 transition-opacity duration-300 group-hover:opacity-100">
      <Corner className="top-0 left-0" />
      <Corner className="top-0 right-0 -scale-x-100" />
      <Corner className="bottom-0 right-0 -scale-100" />
      <Corner className="bottom-0 left-0 -scale-y-100" />
    </div>
  );
}
