// Printable ASCII only. Mirrors Backend/src/shared/validation/english-text.ts — the Backend
// is the real gate; this just gives the customer an instant message instead of a 400.
export function isEnglishText(value: string | undefined): boolean {
  return /^[\x20-\x7E]*$/.test(value ?? '');
}
