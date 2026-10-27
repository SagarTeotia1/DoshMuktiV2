-- Which Ekart account booked the shipment (1 = prepaid, 2 = COD). Every Ekart shipment
-- before this column existed was booked on the single original account, i.e. account 2.
ALTER TABLE "Shipment" ADD COLUMN "ekartAccount" INTEGER;
UPDATE "Shipment" SET "ekartAccount" = 2 WHERE "carrier" = 'EKART';
