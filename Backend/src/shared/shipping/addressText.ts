// Ekart rejects a booking outright ("special characters are present in address line")
// when free-text fields carry anything outside plain ASCII letters/digits and basic
// punctuation — a customer pasting an address with an accented letter, '#', '&', brackets
// or a smart quote is enough. Pure — no I/O. Accents are stripped (ĺ → l), '/' becomes '-'
// ("12/3" → "12-3"), and every other disallowed character becomes a space.
export function sanitizeCarrierText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\//g, '-')
    .replace(/[^A-Za-z0-9 ,.\-]/g, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/,{2,}/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.\-]+|[\s,.\-]+$/g, '')
    .trim();
}

export function joinAddressLines(lines: Array<string | undefined>): string {
  return lines
    .map((l) => sanitizeCarrierText(l ?? ''))
    .filter(Boolean)
    .join(', ');
}
