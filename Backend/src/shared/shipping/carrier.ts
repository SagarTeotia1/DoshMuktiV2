import { EKART_MIN_WEIGHT_GRAMS } from '../constants/purposes';

export type PaymentMethodId = 'PREPAID' | 'COD';
export type CarrierId = 'DELHIVERY' | 'EKART';

// COD always goes Ekart; prepaid goes Ekart only when heavier than the threshold.
// Pure — no I/O — so checkout, booking and tests all share one rule.
export function chooseCarrier(paymentMethod: PaymentMethodId, weightGrams: number): CarrierId {
  if (paymentMethod === 'COD') return 'EKART';
  return weightGrams > EKART_MIN_WEIGHT_GRAMS ? 'EKART' : 'DELHIVERY';
}

export interface PaymentBreakdown {
  /** Amount charged online through Razorpay right now (0 for COD). */
  payNow: number;
  /** Cash collected by the courier on delivery (0 for prepaid). */
  codAmountDue: number;
}

// COD is full cash on delivery — nothing is charged online, the courier collects the whole
// order total. (Orders placed before this change carry a codAdvanceAmount that was paid
// online; that column is kept for their history and is 0 on every new order.)
export function computePaymentBreakdown(paymentMethod: PaymentMethodId, orderTotal: number): PaymentBreakdown {
  if (paymentMethod === 'PREPAID') return { payNow: orderTotal, codAmountDue: 0 };
  return { payNow: 0, codAmountDue: orderTotal };
}
