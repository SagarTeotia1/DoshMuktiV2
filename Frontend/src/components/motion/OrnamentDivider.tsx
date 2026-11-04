/** Small section separator: a short rule, a tiny four-point star, a short rule. */
export function OrnamentDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-1 sm:py-1.5 ${className}`} aria-hidden>
      <span className="h-[2px] w-14 rounded-full bg-gradient-to-r from-transparent to-[#9C5A26] sm:w-24" />
      <svg width="16" height="16" viewBox="0 0 14 14" fill="#9C5A26">
        <path d="M7 0 8.6 5.4 14 7 8.6 8.6 7 14 5.4 8.6 0 7 5.4 5.4Z" />
      </svg>
      <span className="h-[2px] w-14 rounded-full bg-gradient-to-l from-transparent to-[#9C5A26] sm:w-24" />
    </div>
  );
}
