// Handles DPDP data-subject requests received by email (access / erasure) — run by hand
// by an admin after verifying the requester controls the phone number.
//
//   npx tsx --env-file=.env scripts/data-request.ts export +919876543210
//   npx tsx --env-file=.env scripts/data-request.ts delete +919876543210          (dry run)
//   npx tsx --env-file=.env scripts/data-request.ts delete +919876543210 --yes    (executes)
//
// Erasure removes the account, saved addresses, reward ledger, OTP records and AI chat
// leads. Orders are KEPT (GST/accounting law requires invoice records), but unlinked from
// the account and stripped of optional PII (email, date of birth). Audit trail goes to stdout.
import { db } from '../src/shared/db/client';
import { hashPhone, normalizePhone } from '../src/shared/utils/phone';

async function collect(phone: string) {
  const phoneHash = hashPhone(phone);
  const [user, addresses, rewards, chatLeads, otps, orders] = await Promise.all([
    db.user.findUnique({ where: { phone } }),
    db.customerAddress.findMany({ where: { phoneHash } }),
    db.rewardPoint.findMany({ where: { phoneHash } }),
    db.chatLead.findMany({ where: { phone } }),
    db.otpVerification.findMany({ where: { phone } }),
    db.order.findMany({
      where: { OR: [{ customerPhone: phone }, ...(await userIdFilter(phone))] },
      include: { items: true },
    }),
  ]);
  return { user, addresses, rewards, chatLeads, otps, orders };
}

async function userIdFilter(phone: string) {
  const user = await db.user.findUnique({ where: { phone }, select: { id: true } });
  return user ? [{ userId: user.id }] : [];
}

async function main() {
  const [mode, rawPhone, flag] = process.argv.slice(2);
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if ((mode !== 'export' && mode !== 'delete') || !phone) {
    console.error('Usage: data-request.ts <export|delete> <+91XXXXXXXXXX> [--yes]');
    process.exit(1);
  }

  const data = await collect(phone);

  if (mode === 'export') {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  console.log(
    `Found for ${phone}: user=${data.user ? 1 : 0}, addresses=${data.addresses.length}, ` +
      `rewardEntries=${data.rewards.length}, chatLeads=${data.chatLeads.length}, ` +
      `otpRecords=${data.otps.length}, orders=${data.orders.length} (orders are retained, PII-trimmed)`
  );
  if (flag !== '--yes') {
    console.log('Dry run. Re-run with --yes to erase.');
    process.exit(0);
  }

  const phoneHash = hashPhone(phone);
  const userId = data.user?.id;
  await db.$transaction([
    db.order.updateMany({
      where: { OR: [{ customerPhone: phone }, ...(userId ? [{ userId }] : [])] },
      data: { userId: null, customerEmail: null, customerDob: null },
    }),
    db.customerAddress.deleteMany({ where: { phoneHash } }),
    db.rewardPoint.deleteMany({ where: { phoneHash } }),
    db.chatLead.deleteMany({ where: { phone } }),
    db.otpVerification.deleteMany({ where: { phone } }),
    ...(userId ? [db.user.delete({ where: { id: userId } })] : []),
  ]);
  console.log(`Erased data for ${phone} at ${new Date().toISOString()}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
