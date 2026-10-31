// Courier labels, invoices and carrier APIs choke on Devanagari/other scripts, so every
// customer-facing name/address field is restricted to printable ASCII (English).
export const ENGLISH_TEXT_RE = /^[\x20-\x7E]*$/;
export const ENGLISH_TEXT_MESSAGE = 'Please type in English (A-Z letters and digits only)';
