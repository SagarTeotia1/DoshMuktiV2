export type LabelSize = '4x6' | 'A4';

const PAGE_CSS: Record<LabelSize, string> = {
  '4x6': '@page { size: 4in 6in; margin: 0; }',
  A4: '@page { size: A4; margin: 0; }',
};

const STORAGE_KEY = 'admin.shippingLabelSize';

export function getStoredLabelSize(): LabelSize {
  if (typeof window === 'undefined') return '4x6';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'A4' ? 'A4' : '4x6';
}

export function setStoredLabelSize(size: LabelSize) {
  window.localStorage.setItem(STORAGE_KEY, size);
}

function base64ToBlobUrl(pdfBase64: string): string {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

// Chrome's popup blocker treats window.open() as untrusted once it happens
// after an await (e.g. in a mutation's onSuccess, once the network response
// comes back) — it silently returns null there even though the same call
// works fine inside a raw click handler. Opening the window synchronously,
// right on click, before the request even starts, keeps it tied to the user
// gesture; the PDF gets written into it once the mutation resolves.
export function openLabelWindow(): Window | null {
  return window.open('', '_blank', 'width=500,height=700');
}

// The backend already returns a PDF cropped and scaled to exactly `size` (fixing
// Delhivery's mismatched page-box bug server-side) — the @page rule here just
// pins the printed physical page to match, since browsers otherwise default to
// A4 with "fit to page" and can still rescale a correctly-sized PDF.
export function writeLabelToWindow(win: Window, pdfBase64: string, size: LabelSize) {
  const blobUrl = base64ToBlobUrl(pdfBase64);

  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
<style>
  ${PAGE_CSS[size]}
  html, body { margin: 0; padding: 0; height: 100%; }
  iframe { width: 100%; height: 100%; border: none; }
</style>
</head>
<body>
  <iframe src="${blobUrl}"></iframe>
</body>
</html>`);
  win.document.close();

  const iframe = win.document.querySelector('iframe');
  iframe?.addEventListener('load', () => {
    win.focus();
    win.print();
  });
}
