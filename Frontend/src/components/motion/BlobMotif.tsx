/** Soft organic blob shape — same corner-anchored decoration language as MandalaMotif
 * (dark sections) and SectionDivider (rhythm breaks), for light sections that need a
 * fill shape rather than a hairline. Two path variants so adjacent corners don't repeat. */
const PATHS = {
  a: 'M45.3,-58.4C58.4,-49.6,68.4,-34.8,71.8,-18.4C75.2,-2,71.9,16,63.2,30.9C54.4,45.8,40.2,57.5,23.9,63.8C7.6,70.1,-10.8,71,-27.6,65.3C-44.4,59.6,-59.6,47.3,-67.2,31.2C-74.8,15.1,-74.8,-4.8,-67.8,-21.3C-60.8,-37.8,-46.8,-50.9,-31.6,-59.1C-16.4,-67.3,0,-70.6,15.5,-68.1C31,-65.6,46.2,-67.3,45.3,-58.4Z',
  b: 'M39.6,-51.5C50.4,-44.1,57.5,-30.9,61.4,-16.4C65.3,-1.9,66,14,60.1,27.1C54.2,40.2,41.7,50.5,27.5,56.9C13.3,63.3,-2.6,65.8,-18.1,62.6C-33.6,59.4,-48.7,50.5,-58.1,37.4C-67.5,24.3,-71.2,7,-68.6,-9.1C-66,-25.2,-57.1,-40.1,-44.6,-47.6C-32.1,-55.1,-16.1,-55.2,-0.5,-54.5C15.1,-53.8,28.8,-58.9,39.6,-51.5Z',
} as const;

export function BlobMotif({ className, variant = 'a' }: { className?: string; variant?: keyof typeof PATHS }) {
  return (
    <svg viewBox="-100 -100 200 200" className={className} aria-hidden>
      <path d={PATHS[variant]} fill="currentColor" />
    </svg>
  );
}
