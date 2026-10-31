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

export async function updateAddress(accountPhone: string, id: string, input: AddressInput) {
  const phoneHash = hashPhone(accountPhone);

  return db.$transaction(async (tx) => {
    // Scoped by phoneHash — never let one customer edit another's saved address just
    // by guessing/enumerating an id.
    const existing = await tx.customerAddress.findFirst({ where: { id, phoneHash } });
    if (!existing) throw new AddressNotFoundError();

    if (input.setDefault) {
      await tx.customerAddress.updateMany({ where: { phoneHash, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return tx.customerAddress.update({
      where: { id },
      data: {
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

// ── Guest checkout (no OTP) ──────────────────────────────────────────────────────────────
// Most recent address saved under this phone, for pre-filling a returning guest's form.
// Deliberately omits receiverPhone/ids — only what the form needs.
export async function findLatestAddressByPhone(rawPhone: string) {
  const row = await db.customerAddress.findFirst({
    where: { phoneHash: hashPhone(rawPhone) },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: { name: true, line1: true, line2: true, city: true, state: true, pincode: true },
  });
  return row;
}

// Called after a successful guest order: remember the address under the typed phone so the
// next order (and a later OTP login) finds it. An address with the same line1 + pincode is
// UPDATED in place (name/line2/city/state edits must stick, not be dropped as "duplicates")
// and becomes the default again; anything else is saved as a new default address.
export async function saveGuestAddress(rawPhone: string, input: AddressInput): Promise<void> {
  const phoneHash = hashPhone(rawPhone);
  const existing = await db.customerAddress.findFirst({
    where: { phoneHash, line1: input.line1, pincode: input.pincode },
    select: { id: true },
  });
  if (!existing) {
    await saveAddress(rawPhone, input);
    return;
  }
  await updateAddress(rawPhone, existing.id, { ...input, setDefault: true });
}
