export type LabelSize = '4x6' | 'A4';

const STORAGE_KEY = 'admin.shippingLabelSize';

export function getStoredLabelSize(): LabelSize {
  if (typeof window === 'undefined') return '4x6';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'A4' ? 'A4' : '4x6';
}

export function setStoredLabelSize(size: LabelSize) {
  window.localStorage.setItem(STORAGE_KEY, size);
}

export function base64ToBlobUrl(pdfBase64: string): string {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

// Chrome's popup blocker treats window.open() as untrusted once it happens
// after an await (e.g. in a mutation's onSuccess) — opening the window
// synchronously right on the click gesture keeps it allowed.
export function openLabelWindow(): Window | null {
  return window.open('', '_blank');
}

/**
 * Loads the PDF directly into the browser window/tab as a native PDF object.
 * This avoids iframe scaling/margin bugs and gives 100% crisp vector rendering
 * with native print (Ctrl+P / thermal printer) and download controls.
 */
export function writeLabelToWindow(win: Window, pdfBase64: string, _size?: LabelSize) {
  const blobUrl = base64ToBlobUrl(pdfBase64);
  win.location.href = blobUrl;
}
