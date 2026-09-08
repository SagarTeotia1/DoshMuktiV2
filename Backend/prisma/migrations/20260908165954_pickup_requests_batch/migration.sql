-- CreateEnum
CREATE TYPE "PickupRequestStatus" AS ENUM ('REQUESTED', 'FAILED');

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "pickupRequestedAt",
ADD COLUMN     "pickupRequestId" TEXT;

-- CreateTable
CREATE TABLE "PickupRequest" (
    "id" TEXT NOT NULL,
    "pickupDate" TEXT NOT NULL,
    "pickupTime" TEXT NOT NULL,
    "expectedPackageCount" INTEGER NOT NULL,
    "delhiveryPickupId" TEXT,
    "status" "PickupRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "PickupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickupRequest_status_idx" ON "PickupRequest"("status");

-- CreateIndex
CREATE INDEX "PickupRequest_createdAt_idx" ON "PickupRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Shipment_pickupRequestId_idx" ON "Shipment"("pickupRequestId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_pickupRequestId_fkey" FOREIGN KEY ("pickupRequestId") REFERENCES "PickupRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

