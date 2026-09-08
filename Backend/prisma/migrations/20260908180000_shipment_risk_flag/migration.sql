-- CreateEnum
CREATE TYPE "ShipmentRiskFlag" AS ENUM ('BAD_ADDRESS', 'HIGH_RISK');

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "riskFlag" "ShipmentRiskFlag",
ADD COLUMN "riskReason" TEXT;

-- CreateIndex
CREATE INDEX "Shipment_riskFlag_idx" ON "Shipment"("riskFlag");
