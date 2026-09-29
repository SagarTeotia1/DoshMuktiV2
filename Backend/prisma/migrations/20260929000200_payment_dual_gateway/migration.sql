-- Purely additive: lets Razorpay and HDFC SmartGateway coexist. The HDFC build running in
-- UAT keeps working untouched (hdfc* columns/indexes stay; only NOT NULL is relaxed and
-- new columns get defaults it doesn't need to know about).

CREATE TYPE "PaymentGateway" AS ENUM ('RAZORPAY', 'HDFC');

-- Default HDFC: UAT inserts rows without this column and they must read back as HDFC.
ALTER TABLE "Payment" ADD COLUMN "gateway" "PaymentGateway" NOT NULL DEFAULT 'HDFC';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "razorpaySignature" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "razorpayRefundId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- Razorpay rows leave hdfcOrderId empty (unique index tolerates multiple NULLs).
ALTER TABLE "Payment" ALTER COLUMN "hdfcOrderId" DROP NOT NULL;

-- Rows created before the HDFC rename were Razorpay payments whose ids got copied into
-- the hdfc* columns (their hdfcOrderId is not a DOSH-… order number). COPY (not move) the
-- ids back so refunds/reconciliation on those old orders keep working, and leave the
-- hdfc* copies in place so nothing the UAT build reads changes.
UPDATE "Payment" SET
  "gateway" = 'RAZORPAY',
  "razorpayOrderId" = "hdfcOrderId",
  "razorpayPaymentId" = "hdfcTxnId",
  "razorpayRefundId" = "hdfcRefundId"
WHERE "hdfcOrderId" IS NOT NULL AND "hdfcOrderId" NOT LIKE 'DOSH-%';
