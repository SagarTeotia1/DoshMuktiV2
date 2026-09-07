import { db } from '../../shared/db/client';
import { hashPhone, normalizePhone } from '../../shared/utils/phone';
import type { AddressInput } from './schema';

export class AddressNotFoundError extends Error {
  constructor() {
    super('Address not found');
    this.name = 'AddressNotFoundError';
  }
}

export async function listAddresses(accountPhone: string) {
  return db.customerAddress.findMany({
    where: { phoneHash: hashPhone(accountPhone) },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });
}

export async function saveAddress(accountPhone: string, input: AddressInput) {
  const phoneHash = hashPhone(accountPhone);

  return db.$transaction(async (tx) => {
    if (input.setDefault) {
      // Only one address can be "the" default shown automatically — clear any existing
      // one for this account before the new row claims it.
      await tx.customerAddress.updateMany({ where: { phoneHash, isDefault: true }, data: { isDefault: false } });
    }
    return tx.customerAddress.create({
      data: {
        phoneHash,
        receiverPhone: normalizePhone(input.receiverPhone),
        name: input.name,
        line1: input.line1,
        line2: input.line2,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        isDefault: input.setDefault,
      },
    });
  });
}

export async function deleteAddress(accountPhone: string, id: string): Promise<void> {
  // Scoped by phoneHash too, not just id — never let one customer delete another's
  // saved address just by guessing/enumerating an id.
  const result = await db.customerAddress.deleteMany({ where: { id, phoneHash: hashPhone(accountPhone) } });
  if (result.count === 0) throw new AddressNotFoundError();
}
