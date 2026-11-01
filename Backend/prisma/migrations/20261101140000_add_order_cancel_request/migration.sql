-- Customer-initiated cancellation request, reviewed by an admin (order status is untouched until then).
ALTER TABLE "Order" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "cancelRequestReason" TEXT;
CREATE INDEX "Order_cancelRequestedAt_idx" ON "Order"("cancelRequestedAt");
