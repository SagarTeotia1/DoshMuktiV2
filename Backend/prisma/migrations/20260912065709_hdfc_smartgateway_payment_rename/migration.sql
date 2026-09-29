-- Rename Payment's Razorpay-specific columns to HDFC SmartGateway equivalents.
-- Backfill before dropping the old columns / adding NOT NULL so existing rows survive.

ALTER TABLE "Payment" ADD COLUMN "hdfcOrderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "hdfcTxnId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "hdfcRefundId" TEXT;

UPDATE "Payment" SET
  "hdfcOrderId" = "razorpayOrderId",
  "hdfcTxnId" = "razorpayPaymentId",
  "hdfcRefundId" = "razorpayRefundId";

ALTER TABLE "Payment" ALTER COLUMN "hdfcOrderId" SET NOT NULL;

DROP INDEX "Payment_razorpayOrderId_key";
CREATE UNIQUE INDEX "Payment_hdfcOrderId_key" ON "Payment"("hdfcOrderId");

ALTER TABLE "Payment" DROP COLUMN "razorpayOrderId";
ALTER TABLE "Payment" DROP COLUMN "razorpayPaymentId";
ALTER TABLE "Payment" DROP COLUMN "razorpaySignature";
ALTER TABLE "Payment" DROP COLUMN "razorpayRefundId";
