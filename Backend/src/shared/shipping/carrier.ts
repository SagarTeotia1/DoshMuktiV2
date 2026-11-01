import { COD_FEE, FREE_SHIPPING_ABOVE } from '../constants/purposes';
import type { EkartAccount } from '../integrations/ekart/accounts';

export type PaymentMethodId = 'PREPAID' | 'COD';
export type CarrierId = 'DELHIVERY' | 'EKART';

// Every parcel goes Ekart first: prepaid on account 1, COD on account 2. Delhivery is the
// fallback, used only when Ekart reports the pincode isn't serviceable (see bookOrderShipment) —
// a wallet/auth/network failure waits for a retry instead. Pure — no I/O.
export function chooseEkartAccount(paymentMethod: PaymentMethodId): EkartAccount {
  return paymentMethod === 'COD' ? 2 : 1;
}

export interface CodFeeConfig {
  /** Subtotal strictly above this pays `feeAbove`; at or below pays `feeBelow` (same rule as free shipping). */
  threshold: number;
  feeBelow: number;
  feeAbove: number;
}

export const DEFAULT_COD_FEE_CONFIG: CodFeeConfig = { threshold: FREE_SHIPPING_ABOVE, feeBelow: COD_FEE, feeAbove: COD_FEE };

// COD handling charge, tiered by subtotal (admin-configurable); 0 for prepaid. Pure � callers
// load the config via modules/settings getCodFeeConfig().
export function computeCodFee(paymentMethod: PaymentMethodId, subtotal: number, config: CodFeeConfig = DEFAULT_COD_FEE_CONFIG): number {
  if (paymentMethod !== 'COD') return 0;
  return subtotal > config.threshold ? config.feeAbove : config.feeBelow;
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

export type ShipmentProvider = 'AUTO' | 'EKART_1' | 'EKART_2' | 'DELHIVERY';

/** Human name shown in Admin: Ekart account 1 = prepaid, account 2 = COD. */
export function providerName(carrier: CarrierId, ekartAccount: number | null | undefined): string {
  if (carrier === 'DELHIVERY') return 'Delhivery';
  return ekartAccount === 1 ? 'Ekart 1 - Prepaid' : 'Ekart 2 - COD';
}
