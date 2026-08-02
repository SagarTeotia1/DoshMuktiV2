/** Decorative sacred-geometry mandala — concentric rings + radiating petals, built from math not an asset.
 * Pure SVG, no client JS needed. Opacity/color controlled by caller via className. */
export function MandalaMotif({ className, petals = 16 }: { className?: string; petals?: number }) {
  const petalLines = Array.from({ length: petals }, (_, i) => {
    const angle = (360 / petals) * i;
    return (
      <line
        key={i}
        x1="100"
        y1="100"
        x2="100"
        y2="8"
        stroke="currentColor"
        strokeWidth="0.5"
        transform={`rotate(${angle} 100 100)`}
      />
    );
  });

  const dots = Array.from({ length: petals }, (_, i) => {
    const angle = (360 / petals) * i * (Math.PI / 180);
    const r = 46;
    const x = 100 + r * Math.cos(angle);
    const y = 100 + r * Math.sin(angle);
    return <circle key={i} cx={x} cy={y} r="2.5" fill="currentColor" />;
  });

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="46" fill="none" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="18" fill="none" stroke="currentColor" strokeWidth="0.5" />
      {petalLines}
      {dots}
    </svg>
  );
}
