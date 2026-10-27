// When the chat may show product cards. Guidance comes first: a visitor who only shared a worry
// gets understanding, an insight and a small practice, not a shop window. Products appear when
// they ask for them, or once there has been real back-and-forth and the model judges them ready.

// Roman Hindi / English words that mean "show me something to buy or do", plus Devanagari.
const PRODUCT_ASK_RE =
  /\b(products?|remed(?:y|ies)|upa+y|kya\s+(?:lu|loon|lun|kharid\w*)|kharid\w*|buy|order|price|daam|kitne\s+ka|cost|bracelet|yantra|rudraksha|ghoda|naal|nariyal|hawan|kavach|suggest\w*|recommend\w*|sujh\w+|konsa|kaunsa|which\s+one|link)\b|उपाय|खरीद|प्रोडक्ट|कीमत|सुझाव|ब्रेसलेट|यंत्र/i;

export const MAX_RECOMMENDED_PRODUCTS = 2;
// Guidance turns the visitor must have had before the model's own "ready" signal is trusted.
export const MIN_TURNS_BEFORE_UNPROMPTED_PRODUCTS = 2;

export function wantsProducts(recentUserText: string): boolean {
  return PRODUCT_ASK_RE.test(recentUserText);
}

export function canShowProducts(p: { asked: boolean; userTurns: number; modelReady: boolean }): boolean {
  return p.asked || (p.modelReady && p.userTurns >= MIN_TURNS_BEFORE_UNPROMPTED_PRODUCTS);
}
