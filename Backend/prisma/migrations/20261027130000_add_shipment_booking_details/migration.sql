-- Which login booked the parcel, why it fell back (if it did), and the carrier rate quote GST split.
ALTER TABLE "Shipment" ADD COLUMN "bookedVia" TEXT, ADD COLUMN "fallbackReason" TEXT, ADD COLUMN "costPreTax" DECIMAL(10,2), ADD COLUMN "costTax" DECIMAL(10,2);
