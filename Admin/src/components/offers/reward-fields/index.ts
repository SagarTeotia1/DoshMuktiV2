import type { ComponentType } from 'react';
import type { OfferReward } from '@/types/api.types';
import type { RewardFieldsProps } from '../offer-form-schema';
import { DisplayMessageFields } from './DisplayMessageFields';
import { PercentageDiscountFields } from './PercentageDiscountFields';
import { FlatDiscountFields } from './FlatDiscountFields';
import { FreeGiftFields } from './FreeGiftFields';
import { BuyXGetYFields } from './BuyXGetYFields';
import { FreeShippingFields } from './FreeShippingFields';

export const REWARD_FIELD_COMPONENTS: Record<OfferReward, ComponentType<RewardFieldsProps>> = {
  DISPLAY_MESSAGE: DisplayMessageFields,
  PERCENTAGE_DISCOUNT: PercentageDiscountFields,
  FLAT_DISCOUNT: FlatDiscountFields,
  FREE_GIFT: FreeGiftFields,
  BUY_X_GET_Y: BuyXGetYFields,
  FREE_SHIPPING: FreeShippingFields,
};
