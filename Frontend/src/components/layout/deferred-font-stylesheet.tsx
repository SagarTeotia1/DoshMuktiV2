'use client';

const HREF = 'https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap';

// media="print" + swap-to-"all" on load keeps this stylesheet off the render-blocking
// critical path (see layout.tsx history — it used to be a plain blocking <link>).
export function DeferredFontStylesheet() {
  return (
    <link
      rel="stylesheet"
      href={HREF}
      media="print"
      onLoad={(e) => {
        (e.currentTarget as HTMLLinkElement).media = 'all';
      }}
    />
  );
}
