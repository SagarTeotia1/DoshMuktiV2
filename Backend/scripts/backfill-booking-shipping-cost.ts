// One-off: run AFTER the bookingShippingCost migration is deployed. Orders whose
// shipment was already booked (waybill exists) before this feature existed never got
// the booking-time quote — re-quotes each one now, same logic as quoteBookingShippingCost
// in orders/service.ts.
import { db } from '../src/shared/db/client';
import { env } from '../src/config/env';
import { calculateShippingCost } from '../src/shared/integrations/delhivery/client';
import { PACKAGING_WEIGHT_GRAMS } from '../src/shared/constants/purposes';

async function main() {
  const orders = await db.order.findMany({
    where: { bookingShippingCost: null, shipment: { delhiveryWaybill: { not: null } } },
    include: { items: { include: { variant: true } } },
  });

  console.log(`Found ${orders.length} booked orders missing bookingShippingCost.\n`);

  for (const order of orders) {
    const address = order.shippingAddress as unknown as { pincode: string };
    const weight =
      order.packageWeightOverride ?? order.items.reduce((sum, i) => sum + i.variant.weight * i.quantity, 0) + PACKAGING_WEIGHT_GRAMS;

    const result = await calculateShippingCost({
      originPincode: env.DELHIVERY_WAREHOUSE_PINCODE,
      destPincode: address.pincode,
      weightGrams: weight,
      paymentMode: 'Pre-paid',
    });

    if (!result) {
      console.log(`${order.orderNumber} | quote failed — skipped`);
      continue;
    }

    await db.order.update({ where: { id: order.id }, data: { bookingShippingCost: result.amount } });
    console.log(`${order.orderNumber} | bookingShippingCost = ${result.amount}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
