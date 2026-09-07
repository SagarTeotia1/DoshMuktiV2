-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "ewaybillNumber" TEXT,
ADD COLUMN     "pickupRequestedAt" TIMESTAMP(3);
