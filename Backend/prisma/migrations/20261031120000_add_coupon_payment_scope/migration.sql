-- CreateEnum
CREATE TYPE "CouponPaymentScope" AS ENUM ('ALL', 'PREPAID_ONLY');

-- AlterTable: new coupons default to ALL (COD + prepaid)
ALTER TABLE "Coupon" ADD COLUMN "paymentScope" "CouponPaymentScope" NOT NULL DEFAULT 'ALL';

-- Business decision: every coupon that exists today becomes prepaid-only, to push customers
-- toward paying online. Admin can switch individual coupons back to "COD & Prepaid".
UPDATE "Coupon" SET "paymentScope" = 'PREPAID_ONLY';
