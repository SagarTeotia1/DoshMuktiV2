-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "razorpayRefundId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
