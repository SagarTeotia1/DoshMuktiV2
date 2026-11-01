interface Props {
  /** Pixel size of the whole tick. */
  size?: number;
  className?: string;
}

// Green success tick: ring pulse + circle outline drawing itself + check stroking in.
// Pure SVG/CSS (keyframes live in globals.css), so it works in server and client components.
export function AnimatedTick({ size = 72, className = '' }: Props) {
  return (
    <span
      role="img"
      aria-label="Success"
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="animate-tick-ring absolute inset-0 rounded-full bg-[#1E7B4A]/30" aria-hidden />
      <svg viewBox="0 0 52 52" width={size} height={size} className="animate-tick-pop relative" aria-hidden>
        <circle cx="26" cy="26" r="24" fill="#E9F6EE" />
        <circle
          className="animate-tick-circle"
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="#1E7B4A"
          strokeWidth="3"
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
        <path
          className="animate-tick-check"
          d="M15 27 l8 8 l14 -16"
          fill="none"
          stroke="#1E7B4A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
