import { COD_ADVANCE_FEE, EKART_MIN_WEIGHT_GRAMS } from '../constants/purposes';

export type PaymentMethodId = 'PREPAID' | 'COD';
export type CarrierId = 'DELHIVERY' | 'EKART';

// COD always goes Ekart; prepaid goes Ekart only when heavier than the threshold.
// Pure — no I/O — so checkout, booking and tests all share one rule.
export function chooseCarrier(paymentMethod: PaymentMethodId, weightGrams: number): CarrierId {
  if (paymentMethod === 'COD') return 'EKART';
  return weightGrams > EKART_MIN_WEIGHT_GRAMS ? 'EKART' : 'DELHIVERY';
}

export interface PaymentBreakdown {
  /** Amount charged online through Razorpay right now. */
  payNow: number;
  /** Cash collected by the courier on delivery (0 for prepaid). */
  codAmountDue: number;
  /** COD advance actually applied (capped at the order total). */
  codAdvance: number;
}

export function computePaymentBreakdown(paymentMethod: PaymentMethodId, orderTotal: number): PaymentBreakdown {
  if (paymentMethod === 'PREPAID') return { payNow: orderTotal, codAmountDue: 0, codAdvance: 0 };
  const codAdvance = Math.min(COD_ADVANCE_FEE, orderTotal);
  return { payNow: codAdvance, codAmountDue: orderTotal - codAdvance, codAdvance };
}
