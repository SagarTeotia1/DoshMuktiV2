// Run: npx tsx --env-file=.env --test tests/ekart-routing.test.mts
// No network, no real DB: global fetch and the Prisma singleton are faked before the app code loads.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

interface FakeShipment { orderId: string; delhiveryWaybill: string | null; carrier: string; ekartAccount: number | null; status: string; bookedVia?: string | null; fallbackReason?: string | null; costPreTax?: number | null; costTax?: number | null }
const fake = {
  order: null as Record<string, unknown> | null,
  orderMap: new Map<string, Record<string, unknown>>(),
  logs: [] as Array<{ orderId: string; note: string; createdBy: string }>,
  shipments: new Map<string, FakeShipment>(),
  orderUpdates: [] as Array<Record<string, unknown>>,
};
const fakeDb = {
  order: { findUnique: async ({ where }: { where: { id: string } }) => fake.orderMap.get(where.id) ?? fake.order, update: async ({ data }: { data: Record<string, unknown> }) => { fake.orderUpdates.push(data); return data; } },
  orderStatusLog: {
    count: async ({ where }: { where: { orderId: string; note: { contains: string } } }) =>
      fake.logs.filter((l) => l.orderId === where.orderId && l.note.includes(where.note.contains)).length,
    create: async ({ data }: { data: { orderId: string; note: string; createdBy: string } }) => { fake.logs.push(data); return data; },
  },
  shipment: {
    findMany: async ({ where }: { where: { carrier: string; status: string } }) =>
      [...fake.shipments.values()]
        .filter((sh) => sh.carrier === where.carrier && sh.status === where.status && sh.delhiveryWaybill)
        .map((sh) => ({ order: fake.orderMap.get(sh.orderId)! }))
        .filter((r) => r.order && ['PAID', 'PROCESSING', 'PACKED'].includes(r.order.status as string)),
    findUnique: async ({ where }: { where: { orderId: string } }) => fake.shipments.get(where.orderId) ?? null,
    findFirst: async () => null,
    create: async ({ data }: { data: FakeShipment }) => { fake.shipments.set(data.orderId, data); return data; },
    update: async ({ where, data }: { where: { orderId: string }; data: Partial<FakeShipment> }) => {
      const cur = fake.shipments.get(where.orderId)!;
      const next = { ...cur, ...data };
      fake.shipments.set(where.orderId, next);
      return next;
    },
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakeDb;

// ── fetch fake ────────────────────────────────────────────────────────────────
interface Call { url: string; method: string; body: string; auth: string }
let calls: Call[] = [];
let ekartCreate: () => Response | Promise<Response> = () => json({ status: true, tracking_id: 'EK-TRACK-1' });
let delhiveryCreate: () => Response | Promise<Response> = () => json({ success: true, packages: [{ waybill: 'DL-WB-1' }] });
let authFails = new Set<string>(); // client ids whose auth call returns 401
let serviceability: (pin: string) => Response = () => json({ status: true, remark: 'Pincode is serviceable', details: { cod: true, forward_drop: true } });
let ekartCancel: () => Response = () => json({ status: true });
let delhiveryCancel: () => Response = () => json({ status: true, waybill: 'x', remark: '' });
let ekartPricing: () => Response = () => json({ preTax: 43, tax: 7.74, total: 50.74 });
let delhiveryRate: () => Response = () => json([{ total_amount: 70, tax_data: { IGST: 10.68 } }]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input);
  const headers = (init.headers ?? {}) as Record<string, string>;
  calls.push({ url, method: init.method ?? 'GET', body: String(init.body ?? ''), auth: headers.Authorization ?? '' });
  const authMatch = /\/integrations\/v2\/auth\/token\/([^/?]+)/.exec(url);
  if (authMatch) {
    const clientId = authMatch[1]!;
    if (authFails.has(clientId)) return json({ message: 'bad credentials' }, 401);
    return json({ access_token: `tok-${clientId}`, expires_in: 3600 });
  }
  const svcMatch = /\/api\/v2\/serviceability\/(\d+)/.exec(url);
  if (svcMatch) return serviceability(svcMatch[1]!);
  if (url.includes('/data/v2/pricing/estimate')) return ekartPricing();
  if (url.includes('/api/kinko/v1/invoice/charges')) return delhiveryRate();
  if (url.includes('/api/v1/package/create')) return ekartCreate();
  if (url.includes('/api/cmu/create.json')) return delhiveryCreate();
  if (url.includes('/api/v1/package/cancel')) return ekartCancel();
  if (url.includes('/api/p/edit')) return delhiveryCancel();
  return json({}, 404);
}) as typeof fetch;

// ── load app code after the fakes are in place ───────────────────────────────
const { env } = await import('../src/config/env');
const carrier = await import('../src/shared/shipping/carrier');
const accounts = await import('../src/shared/integrations/ekart/accounts');
const ekart = await import('../src/shared/integrations/ekart/client');
const orders = await import('../src/modules/orders/service');
const webhooks = await import('../src/modules/webhooks/service');
const controller = await import('../src/modules/webhooks/controller');

const E1 = { id: 'EKART_ONE', user: 'one@x.in', pass: 'p1', alias: 'WH PREPAID', hook: 'hook-one-token' };
const E2 = { id: 'EKART_TWO', user: 'two@x.in', pass: 'p2', alias: 'WH COD', hook: 'hook-two-token' };

function resetEnv() {
  Object.assign(env, {
    EKART1_CLIENT_ID: E1.id, EKART1_USERNAME: E1.user, EKART1_PASSWORD: E1.pass, EKART1_PICKUP_ALIAS: E1.alias, EKART1_WEBHOOK_TOKEN: E1.hook,
    EKART_CLIENT_ID: E2.id, EKART_USERNAME: E2.user, EKART_PASSWORD: E2.pass, EKART_PICKUP_ALIAS: E2.alias, EKART_WEBHOOK_TOKEN: E2.hook,
    DELHIVERY_API_KEY: 'dl-key',
  });
}

function makeOrder(paymentMethod: 'PREPAID' | 'COD', over: Record<string, unknown> = {}) {
  return {
    id: 'ord1',
    status: 'PAID',
    orderNumber: 'DOSH-TEST-0001',
    customerName: 'Test User',
    customerPhone: '9876543210',
    paymentMethod,
    total: 499,
    codAmountDue: paymentMethod === 'COD' ? 499 : 0,
    packageWeightOverride: null,
    createdAt: new Date('2026-10-27T00:00:00Z'),
    shippingAddress: { line1: '1 Test Rd', city: 'Delhi', state: 'Delhi', pincode: '110001' },
    items: [{ quantity: 1, priceAtPurchase: 499, variantSnapshot: { productName: 'Yantra' }, variant: { weight: 200, sku: 'SKU1' } }],
    ...over,
  };
}

beforeEach(() => {
  ekart.resetEkartTokenCache();
  resetEnv();
  calls = [];
  fake.shipments.clear();
  fake.order = makeOrder('PREPAID');
  authFails = new Set();
  fake.orderUpdates = [];
  serviceability = () => json({ status: true, remark: 'Pincode is serviceable', details: { cod: true, forward_drop: true } });
  ekartPricing = () => json({ preTax: 43, tax: 7.74, total: 50.74 });
  delhiveryRate = () => json([{ total_amount: 70, tax_data: { IGST: 10.68 } }]);
  ekartCancel = () => json({ status: true });
  delhiveryCancel = () => json({ status: true, waybill: 'x', remark: '' });
  fake.orderMap = new Map();
  fake.logs = [];
  ekartCreate = () => json({ status: true, tracking_id: 'EK-TRACK-1' });
  delhiveryCreate = () => json({ success: true, packages: [{ waybill: 'DL-WB-1' }] });
});

const createCalls = () => calls.filter((c) => c.url.includes('/package/create'));
const delhiveryCalls = () => calls.filter((c) => c.url.includes('/api/cmu/create.json'));

describe('pure routing helpers', () => {
  test('chooseEkartAccount: prepaid -> 1, COD -> 2', () => {
    assert.equal(carrier.chooseEkartAccount('PREPAID'), 1);
    assert.equal(carrier.chooseEkartAccount('COD'), 2);
  });
  test('toEkartAccount: null/unknown default to 2 (legacy rows)', () => {
    assert.equal(accounts.toEkartAccount(1), 1);
    assert.equal(accounts.toEkartAccount(2), 2);
    assert.equal(accounts.toEkartAccount(null), 2);
    assert.equal(accounts.toEkartAccount(undefined), 2);
    assert.equal(accounts.toEkartAccount(7), 2);
  });
  test('ekartConfig maps each account to its own env vars', () => {
    assert.equal(accounts.ekartConfig(1).clientId, E1.id);
    assert.equal(accounts.ekartConfig(1).pickupAlias, E1.alias);
    assert.equal(accounts.ekartConfig(2).clientId, E2.id);
    assert.equal(accounts.ekartConfig(2).webhookToken, E2.hook);
  });
  test('COD fee + payment breakdown unchanged', () => {
    assert.equal(carrier.computeCodFee('COD', 500), 50);
    assert.equal(carrier.computeCodFee('COD', 299), 0);
    assert.equal(carrier.computeCodFee('COD', 100), 0);
    assert.equal(carrier.computeCodFee('PREPAID', 500), 0);
    assert.deepEqual(carrier.computePaymentBreakdown('COD', 700), { payNow: 0, codAmountDue: 700 });
    assert.deepEqual(carrier.computePaymentBreakdown('PREPAID', 700), { payNow: 700, codAmountDue: 0 });
  });
});

describe('isUnserviceableRemark', () => {
  const yes = ['Pincode not serviceable', 'pin code 110099 is Not Serviceable', 'Destination is non-serviceable', 'Non serviceable area', 'No courier available for this route', 'Invalid pincode: not found'];
  const no = ['Insufficient wallet balance', 'Authentication failed', 'Internal server error', 'Invalid phone number', 'Address too long', 'Ekart returned HTTP 500', ''];
  for (const t of yes) test(`serviceable-error: "${t}"`, () => assert.equal(ekart.isUnserviceableRemark(t), true));
  for (const t of no) test(`other error: "${t}"`, () => assert.equal(ekart.isUnserviceableRemark(t), false));
});

describe('ekart client', () => {
  const params = {
    orderNumber: 'X', customerName: 'A', customerPhone: '9876543210',
    address: { line1: 'l1', city: 'c', state: 's', pincode: '110001' },
    weight: 300, codAmount: 0, orderTotal: 100, taxValue: 5, productsDesc: 'p', quantity: 1, invoiceDate: '2026-10-27',
  };

  test('isEkartConfigured is per account', () => {
    env.EKART1_PASSWORD = '';
    assert.equal(ekart.isEkartConfigured(1), false);
    assert.equal(ekart.isEkartConfigured(2), true);
  });
  test('unconfigured account returns null without any HTTP call', async () => {
    env.EKART1_CLIENT_ID = '';
    assert.equal(await ekart.createEkartShipment(1, params), null);
    assert.equal(calls.length, 0);
  });
  test('account 1 authenticates with account 1 creds + pickup alias; account 2 with its own', async () => {
    const r1 = await ekart.createEkartShipment(1, params);
    assert.deepEqual(r1, { waybill: 'EK-TRACK-1' });
    const r2 = await ekart.createEkartShipment(2, { ...params, codAmount: 100 });
    assert.deepEqual(r2, { waybill: 'EK-TRACK-1' });
    const auths = calls.filter((c) => c.url.includes('/auth/token/'));
    assert.ok(auths.some((c) => c.url.endsWith(E1.id) && c.body.includes(E1.user)));
    assert.ok(auths.some((c) => c.url.endsWith(E2.id) && c.body.includes(E2.user)));
    const [c1, c2] = createCalls();
    assert.equal(c1!.auth, `Bearer tok-${E1.id}`);
    assert.equal(c2!.auth, `Bearer tok-${E2.id}`);
    assert.deepEqual(JSON.parse(c1!.body).pickup_location, { name: E1.alias });
    assert.deepEqual(JSON.parse(c2!.body).pickup_location, { name: E2.alias });
    assert.equal(JSON.parse(c1!.body).payment_mode, 'Prepaid');
    assert.equal(JSON.parse(c2!.body).payment_mode, 'COD');
  });
  test('tokens are cached per account (no second auth call)', async () => {
    await ekart.createEkartShipment(1, params);
    await ekart.createEkartShipment(1, params);
    assert.equal(calls.filter((c) => c.url.includes(`/auth/token/${E1.id}`)).length, 1);
  });
  test('HTTP 400 "pincode not serviceable" -> unserviceable', async () => {
    ekartCreate = () => json({ remark: 'Pincode not serviceable' }, 400);
    const r = await ekart.createEkartShipment(1, params);
    assert.deepEqual(r, { error: 'Pincode not serviceable', unserviceable: true });
  });
  test('HTTP 200 status:false with unserviceable remark -> unserviceable', async () => {
    ekartCreate = () => json({ status: false, remark: 'Destination pincode non serviceable' });
    const r = (await ekart.createEkartShipment(1, params)) as { unserviceable: boolean };
    assert.equal(r.unserviceable, true);
  });
  test('wallet empty -> NOT unserviceable', async () => {
    ekartCreate = () => json({ remark: 'Insufficient wallet balance' }, 400);
    const r = (await ekart.createEkartShipment(1, params)) as { unserviceable: boolean };
    assert.equal(r.unserviceable, false);
  });
  test('HTTP 500 even with serviceability words -> NOT unserviceable', async () => {
    ekartCreate = () => json({ remark: 'serviceability service unavailable' }, 503);
    const r = (await ekart.createEkartShipment(1, params)) as { unserviceable: boolean };
    assert.equal(r.unserviceable, false);
  });
  test('network error on create -> error, NOT unserviceable', async () => {
    ekartCreate = () => { throw new TypeError('fetch failed'); };
    const r = (await ekart.createEkartShipment(1, params)) as { error: string; unserviceable: boolean };
    assert.equal(r.unserviceable, false);
    assert.match(r.error, /fetch failed/);
  });
  test('bad credentials -> error mentioning the account, NOT unserviceable', async () => {
    authFails.add(E1.id);
    const r = (await ekart.createEkartShipment(1, params)) as { error: string; unserviceable: boolean };
    assert.equal(r.unserviceable, false);
    assert.match(r.error, /account 1 auth failed/);
  });
  test('COD over 49,999 rejected locally', async () => {
    const r = (await ekart.createEkartShipment(2, { ...params, codAmount: 50_000 })) as { error: string; unserviceable: boolean };
    assert.match(r.error, /49,999/);
    assert.equal(calls.length, 0);
  });
});

describe('bookOrderShipment', () => {
  test('prepaid -> Ekart account 1, no Delhivery call', async () => {
    const r = await orders.bookOrderShipment('ord1');
    assert.deepEqual(r, { waybill: 'EK-TRACK-1', carrier: 'EKART', ekartAccount: 1 });
    const s = fake.shipments.get('ord1')!;
    assert.equal(s.carrier, 'EKART');
    assert.equal(s.ekartAccount, 1);
    assert.equal(s.status, 'BOOKED');
    assert.equal(delhiveryCalls().length, 0);
    assert.equal(createCalls()[0]!.auth, `Bearer tok-${E1.id}`);
  });
  test('COD -> Ekart account 2 with cod_amount', async () => {
    fake.order = makeOrder('COD');
    const r = await orders.bookOrderShipment('ord1');
    assert.equal(r.carrier, 'EKART');
    assert.equal(fake.shipments.get('ord1')!.ekartAccount, 2);
    const body = JSON.parse(createCalls()[0]!.body);
    assert.equal(body.cod_amount, 499);
    assert.equal(body.payment_mode, 'COD');
    assert.equal(createCalls()[0]!.auth, `Bearer tok-${E2.id}`);
  });
  test('light prepaid parcel (<500g) still goes Ekart (weight rule dropped)', async () => {
    const r = await orders.bookOrderShipment('ord1');
    assert.equal(r.carrier, 'EKART');
  });
  test('heavy prepaid parcel -> Ekart account 1', async () => {
    fake.order = makeOrder('PREPAID', { items: [{ quantity: 5, priceAtPurchase: 100, variantSnapshot: {}, variant: { weight: 900, sku: 'H' } }] });
    await orders.bookOrderShipment('ord1');
    assert.equal(fake.shipments.get('ord1')!.ekartAccount, 1);
  });
  test('unserviceable pincode (prepaid) -> falls back to Delhivery, prepaid payload', async () => {
    ekartCreate = () => json({ remark: 'Pincode not serviceable' }, 400);
    const r = await orders.bookOrderShipment('ord1');
    assert.deepEqual(r, { waybill: 'DL-WB-1', carrier: 'DELHIVERY', ekartAccount: null });
    const s = fake.shipments.get('ord1')!;
    assert.equal(s.carrier, 'DELHIVERY');
    assert.equal(s.ekartAccount, null);
    assert.equal(createCalls().length, 1);
    assert.equal(delhiveryCalls().length, 1);
  });
  test('unserviceable pincode (COD) -> Delhivery keeps the COD amount', async () => {
    fake.order = makeOrder('COD');
    ekartCreate = () => json({ remark: 'Pincode not serviceable' }, 400);
    await orders.bookOrderShipment('ord1');
    const body = decodeURIComponent(delhiveryCalls()[0]!.body.split('data=')[1]!);
    assert.match(body, /"payment_mode":"COD"|"cod_amount":"?499/i);
  });
  test('wallet empty -> throws, NO Delhivery fallback, no shipment row', async () => {
    ekartCreate = () => json({ remark: 'Insufficient wallet balance' }, 400);
    await assert.rejects(orders.bookOrderShipment('ord1'), /Ekart 1 - Prepaid: Insufficient wallet balance.*no fallback/);
    assert.equal(delhiveryCalls().length, 0);
    assert.equal(fake.shipments.size, 0);
  });
  test('Ekart down (503) -> throws, no fallback', async () => {
    ekartCreate = () => json({ message: 'Service Unavailable' }, 503);
    await assert.rejects(orders.bookOrderShipment('ord1'), /no fallback/);
    assert.equal(delhiveryCalls().length, 0);
  });
  test('Ekart network failure -> throws, no fallback', async () => {
    ekartCreate = () => { throw new TypeError('fetch failed'); };
    await assert.rejects(orders.bookOrderShipment('ord1'), /fetch failed.*no fallback/);
    assert.equal(delhiveryCalls().length, 0);
  });
  test('bad Ekart credentials -> throws, no fallback', async () => {
    authFails.add(E1.id);
    await assert.rejects(orders.bookOrderShipment('ord1'), /auth failed.*no fallback/);
    assert.equal(delhiveryCalls().length, 0);
  });
  test('account not configured -> throws, no fallback', async () => {
    env.EKART1_CLIENT_ID = '';
    await assert.rejects(orders.bookOrderShipment('ord1'), /Ekart 1 - Prepaid: not configured/);
    assert.equal(calls.length, 0);
  });
  test('one account down does not affect the other', async () => {
    authFails.add(E1.id);
    fake.order = makeOrder('COD');
    const r = await orders.bookOrderShipment('ord1');
    assert.equal(r.carrier, 'EKART');
    assert.equal(fake.shipments.get('ord1')!.ekartAccount, 2);
  });
  test('unserviceable + Delhivery rejects -> throws with both reasons', async () => {
    ekartCreate = () => json({ remark: 'Pincode not serviceable' }, 400);
    delhiveryCreate = () => json({ success: false, packages: [{ waybill: '', remarks: ['Invalid PIN'] }] });
    await assert.rejects(orders.bookOrderShipment('ord1'), /Ekart 1 - Prepaid: Pincode not serviceable \| Delhivery: Invalid PIN/);
    assert.equal(fake.shipments.size, 0);
  });
  test('unserviceable + Delhivery not configured -> throws', async () => {
    ekartCreate = () => json({ remark: 'Pincode not serviceable' }, 400);
    env.DELHIVERY_API_KEY = '';
    await assert.rejects(orders.bookOrderShipment('ord1'), /Delhivery: not configured/);
  });
  test('already booked -> refuses, no HTTP', async () => {
    fake.shipments.set('ord1', { orderId: 'ord1', delhiveryWaybill: 'OLD', carrier: 'EKART', ekartAccount: 2, status: 'BOOKED' });
    await assert.rejects(orders.bookOrderShipment('ord1'), /already has a shipment/);
    assert.equal(calls.length, 0);
  });
  test('existing PENDING shipment row (no waybill) is updated, not duplicated', async () => {
    fake.shipments.set('ord1', { orderId: 'ord1', delhiveryWaybill: null, carrier: 'DELHIVERY', ekartAccount: null, status: 'PENDING' });
    await orders.bookOrderShipment('ord1');
    const s = fake.shipments.get('ord1')!;
    assert.equal(s.delhiveryWaybill, 'EK-TRACK-1');
    assert.equal(s.ekartAccount, 1);
  });
  test('packageWeightOverride is the declared weight', async () => {
    fake.order = makeOrder('PREPAID', { packageWeightOverride: 1234 });
    await orders.bookOrderShipment('ord1');
    assert.equal(JSON.parse(createCalls()[0]!.body).weight, 1234);
  });
  test('missing order -> throws', async () => {
    fake.order = null;
    await assert.rejects(orders.bookOrderShipment('ord1'), /Order not found/);
  });
});

describe('serviceability pre-check', () => {
  test('Ekart says not serviceable -> Delhivery, Ekart create never called, reason recorded', async () => {
    serviceability = () => json({ status: false, pincode: 744101, remark: 'Pincode is not serviceable' });
    const r = await orders.bookOrderShipment('ord1');
    assert.equal(r.carrier, 'DELHIVERY');
    assert.equal(createCalls().length, 0);
    const s = fake.shipments.get('ord1')!;
    assert.equal(s.fallbackReason, 'Ekart account 1: Pincode is not serviceable');
    assert.equal(s.ekartAccount, null);
  });
  test('COD order where Ekart has no COD at pincode -> Delhivery with cash collection', async () => {
    fake.order = makeOrder('COD');
    serviceability = () => json({ status: true, remark: 'Pincode is serviceable', details: { cod: false, forward_drop: true } });
    const r = await orders.bookOrderShipment('ord1');
    assert.equal(r.carrier, 'DELHIVERY');
    assert.equal(createCalls().length, 0);
    assert.match(fake.shipments.get('ord1')!.fallbackReason!, /COD is not available/);
  });
  test('prepaid still books on Ekart when only COD is unavailable', async () => {
    serviceability = () => json({ status: true, remark: 'ok', details: { cod: false, forward_drop: true } });
    assert.equal((await orders.bookOrderShipment('ord1')).carrier, 'EKART');
  });
  test('forward_drop false -> not serviceable', async () => {
    serviceability = () => json({ status: true, remark: 'ok', details: { cod: true, forward_drop: false } });
    assert.equal((await orders.bookOrderShipment('ord1')).carrier, 'DELHIVERY');
  });
  test('serviceability API error is inconclusive -> books on Ekart normally', async () => {
    serviceability = () => json({ message: 'boom' }, 500);
    assert.equal((await orders.bookOrderShipment('ord1')).carrier, 'EKART');
  });
  test('serviceability inconclusive + wallet empty -> still waits (no fallback)', async () => {
    serviceability = () => json({}, 500);
    ekartCreate = () => json({ remark: 'Insufficient wallet balance' }, 400);
    await assert.rejects(orders.bookOrderShipment('ord1'), /no fallback/);
    assert.equal(delhiveryCalls().length, 0);
  });
  test('wallet empty is not mistaken for unserviceable even when pincode check is fine', async () => {
    ekartCreate = () => json({ remark: 'Insufficient wallet balance' }, 400);
    await assert.rejects(orders.bookOrderShipment('ord1'), /no fallback/);
  });
});

describe('booking record + cost quote', () => {
  test('Ekart prepaid: bookedVia is the account email, cost quote with GST stored', async () => {
    await orders.bookOrderShipment('ord1');
    const s = fake.shipments.get('ord1')!;
    assert.equal(s.bookedVia, E1.user);
    assert.equal(s.fallbackReason, null);
    assert.equal(s.costTax, 7.74);
    assert.equal(s.costPreTax, 43);
    assert.deepEqual(fake.orderUpdates.at(-1), { bookingShippingCost: 50.74 });
  });
  test('Ekart COD: account 2 email, quote requested with COD amount', async () => {
    fake.order = makeOrder('COD');
    let sent: Record<string, unknown> = {};
    ekartPricing = () => { sent = JSON.parse(calls.find((c) => c.url.includes('/pricing/estimate'))?.body ?? '{}'); return json({ preTax: 75, tax: 13.5, total: 88.5 }); };
    await orders.bookOrderShipment('ord1');
    assert.equal(fake.shipments.get('ord1')!.bookedVia, E2.user);
    assert.equal(fake.orderUpdates.at(-1)!.bookingShippingCost, 88.5);
    assert.equal(sent.codAmount, 499);
    assert.equal(sent.pickupPincode, Number(env.DELHIVERY_WAREHOUSE_PINCODE));
    assert.equal(sent.dropPincode, 110001);
  });
  test('quote uses the declared weight (override)', async () => {
    fake.order = makeOrder('PREPAID', { packageWeightOverride: 2500 });
    await orders.bookOrderShipment('ord1');
    const q = JSON.parse(calls.find((c) => c.url.includes('/pricing/estimate'))!.body);
    assert.equal(q.weight, 2500);
  });
  test('quote failure never fails the booking', async () => {
    ekartPricing = () => json({ message: 'down' }, 500);
    const r = await orders.bookOrderShipment('ord1');
    assert.equal(r.carrier, 'EKART');
    assert.equal(fake.orderUpdates.length, 0);
  });
  test('Delhivery fallback: bookedVia is client name, Delhivery rate (with tax split) stored, COD mode for COD', async () => {
    fake.order = makeOrder('COD');
    serviceability = () => json({ status: false, remark: 'Pincode is not serviceable' });
    await orders.bookOrderShipment('ord1');
    const s = fake.shipments.get('ord1')!;
    assert.equal(s.bookedVia, env.DELHIVERY_CLIENT_NAME);
    assert.equal(s.costTax, 10.68);
    assert.equal(s.costPreTax, 59.32);
    assert.equal(fake.orderUpdates.at(-1)!.bookingShippingCost, 70);
    const rateCall = calls.find((c) => c.url.includes('/invoice/charges'))!;
    assert.match(rateCall.url, /pt=COD/);
  });
  test('Delhivery rate without tax data stores total only', async () => {
    serviceability = () => json({ status: false, remark: 'Pincode is not serviceable' });
    delhiveryRate = () => json([{ total_amount: 82 }]);
    await orders.bookOrderShipment('ord1');
    const s = fake.shipments.get('ord1')!;
    assert.equal(s.costTax ?? null, null);
    assert.equal(fake.orderUpdates.at(-1)!.bookingShippingCost, 82);
  });
});

describe('ekart serviceability + estimate clients', () => {
  test('checkEkartServiceability: unconfigured / bad pincode -> null without HTTP', async () => {
    assert.equal(await ekart.checkEkartServiceability(1, '12'), null);
    env.EKART1_CLIENT_ID = '';
    assert.equal(await ekart.checkEkartServiceability(1, '110001'), null);
    assert.equal(calls.length, 0);
  });
  test('checkEkartServiceability parses serviceable details', async () => {
    assert.deepEqual(await ekart.checkEkartServiceability(1, '110001'), { serviceable: true, codAllowed: true, remark: 'Pincode is serviceable' });
  });
  test('estimateEkartCost parses the quote', async () => {
    const q = await ekart.estimateEkartCost(1, { originPincode: '110085', destPincode: '400001', weight: 500, codAmount: 0, invoiceAmount: 499 });
    assert.deepEqual(q, { preTax: 43, tax: 7.74, total: 50.74 });
  });
  test('estimateEkartCost network error -> null', async () => {
    ekartPricing = () => { throw new TypeError('x'); };
    assert.equal(await ekart.estimateEkartCost(1, { originPincode: '110085', destPincode: '400001', weight: 500, codAmount: 0, invoiceAmount: 499 }), null);
  });
});

const ekartCalls = () => calls.filter((c) => c.url.includes('/package/create'));
const cancelCalls = () => calls.filter((c) => c.url.includes('/package/cancel') || c.url.includes('/api/p/edit'));
const put = (orderId: string, over: Partial<FakeShipment>) =>
  fake.shipments.set(orderId, { orderId, delhiveryWaybill: 'OLD-WB', carrier: 'DELHIVERY', ekartAccount: null, status: 'BOOKED', ...over });

describe('explicit provider choice', () => {
  test('EKART_2 on a prepaid order books Ekart 2 (admin override of the auto rule)', async () => {
    const r = await orders.bookOrderShipment('ord1', 'EKART_2');
    assert.deepEqual(r, { waybill: 'EK-TRACK-1', carrier: 'EKART', ekartAccount: 2 });
    assert.equal(ekartCalls()[0]!.auth, `Bearer tok-${E2.id}`);
    assert.equal(fake.shipments.get('ord1')!.bookedVia, E2.user);
  });
  test('EKART_1 on a COD order books Ekart 1 and still collects cash', async () => {
    fake.order = makeOrder('COD');
    await orders.bookOrderShipment('ord1', 'EKART_1');
    assert.equal(ekartCalls()[0]!.auth, `Bearer tok-${E1.id}`);
    assert.equal(JSON.parse(ekartCalls()[0]!.body).cod_amount, 499);
  });
  test('DELHIVERY books Delhivery only - no Ekart call, no fallback reason, COD kept', async () => {
    fake.order = makeOrder('COD');
    const r = await orders.bookOrderShipment('ord1', 'DELHIVERY');
    assert.deepEqual(r, { waybill: 'DL-WB-1', carrier: 'DELHIVERY', ekartAccount: null });
    assert.equal(ekartCalls().length, 0);
    assert.equal(calls.filter((c) => c.url.includes('/serviceability/')).length, 0);
    const sh = fake.shipments.get('ord1')!;
    assert.equal(sh.fallbackReason, null);
    assert.equal(sh.bookedVia, env.DELHIVERY_CLIENT_NAME);
    assert.match(decodeURIComponent(delhiveryCalls()[0]!.body), /"payment_mode":"COD"/);
  });
  test('chosen Ekart account cannot serve the pincode -> error, NO silent Delhivery fallback', async () => {
    serviceability = () => json({ status: false, remark: 'Pincode is not serviceable' });
    await assert.rejects(orders.bookOrderShipment('ord1', 'EKART_1'), /Ekart 1 - Prepaid: Pincode is not serviceable.*you chose this provider/);
    assert.equal(delhiveryCalls().length, 0);
    assert.equal(fake.shipments.size, 0);
  });
  test('chosen Delhivery rejects -> error, no Ekart', async () => {
    delhiveryCreate = () => json({ success: false, packages: [{ waybill: '', remarks: ['Invalid PIN'] }] });
    await assert.rejects(orders.bookOrderShipment('ord1', 'DELHIVERY'), /Delhivery: Invalid PIN/);
    assert.equal(ekartCalls().length, 0);
  });
  test('chosen Ekart account not configured -> error', async () => {
    env.EKART_CLIENT_ID = '';
    await assert.rejects(orders.bookOrderShipment('ord1', 'EKART_2'), /Ekart 2 - COD: not configured/);
  });
  test('AUTO is unchanged: unserviceable still falls back to Delhivery', async () => {
    serviceability = () => json({ status: false, remark: 'Pincode is not serviceable' });
    assert.equal((await orders.bookOrderShipment('ord1', 'AUTO')).carrier, 'DELHIVERY');
  });
});

describe('cancelCarrierShipment', () => {
  test('Ekart 1 cancels with account 1 credentials', async () => {
    const r = await orders.cancelCarrierShipment({ carrier: 'EKART', delhiveryWaybill: 'W1', ekartAccount: 1 });
    assert.equal(r.success, true);
    assert.equal(cancelCalls()[0]!.auth, `Bearer tok-${E1.id}`);
    assert.match(cancelCalls()[0]!.url, /tracking_id=W1/);
  });
  test('Ekart with no account marker (old rows) cancels as account 2', async () => {
    await orders.cancelCarrierShipment({ carrier: 'EKART', delhiveryWaybill: 'W1', ekartAccount: null });
    assert.equal(cancelCalls()[0]!.auth, `Bearer tok-${E2.id}`);
  });
  test('Delhivery cancels via /api/p/edit with the waybill and cancellation flag', async () => {
    const r = await orders.cancelCarrierShipment({ carrier: 'DELHIVERY', delhiveryWaybill: 'DW1', ekartAccount: null });
    assert.equal(r.success, true);
    const c = cancelCalls()[0]!;
    assert.match(c.url, /\/api\/p\/edit$/);
    assert.deepEqual(JSON.parse(c.body), { waybill: 'DW1', cancellation: 'true' });
    assert.equal(c.auth, 'Token dl-key');
  });
  test('Delhivery refusal (already picked up) surfaces the reason', async () => {
    delhiveryCancel = () => json({ status: false, remark: 'Shipment cannot be cancelled in this state' });
    const r = await orders.cancelCarrierShipment({ carrier: 'DELHIVERY', delhiveryWaybill: 'DW1', ekartAccount: null });
    assert.deepEqual(r, { success: false, error: 'Shipment cannot be cancelled in this state' });
  });
  test('Delhivery HTTP error / network error never throw', async () => {
    delhiveryCancel = () => json({ error: 'nope' }, 500);
    assert.equal((await orders.cancelCarrierShipment({ carrier: 'DELHIVERY', delhiveryWaybill: 'DW1', ekartAccount: null })).success, false);
    delhiveryCancel = () => { throw new TypeError('fetch failed'); };
    const r = await orders.cancelCarrierShipment({ carrier: 'DELHIVERY', delhiveryWaybill: 'DW1', ekartAccount: null });
    assert.deepEqual(r, { success: false, error: 'fetch failed' });
  });
  test('no waybill -> nothing to cancel, no HTTP', async () => {
    assert.equal((await orders.cancelCarrierShipment({ carrier: 'EKART', delhiveryWaybill: null, ekartAccount: 1 })).success, false);
    assert.equal(calls.length, 0);
  });
});

describe('cancelShipmentForCancelledOrder (order cancelled -> parcel cancelled)', () => {
  test('booked Delhivery parcel is cancelled and noted', async () => {
    put('ord1', { carrier: 'DELHIVERY' });
    await orders.cancelShipmentForCancelledOrder('ord1', 'admin@x.in');
    assert.equal(cancelCalls().length, 1);
    assert.match(cancelCalls()[0]!.url, /\/api\/p\/edit/);
    assert.equal(fake.shipments.get('ord1')!.status, 'FAILED');
    assert.match(fake.logs.at(-1)!.note, /Delhivery shipment OLD-WB cancelled/);
  });
  test('booked Ekart 1 parcel is cancelled with account 1 and named correctly', async () => {
    put('ord1', { carrier: 'EKART', ekartAccount: 1 });
    await orders.cancelShipmentForCancelledOrder('ord1', 'admin@x.in');
    assert.equal(cancelCalls()[0]!.auth, `Bearer tok-${E1.id}`);
    assert.match(fake.logs.at(-1)!.note, /Ekart 1 - Prepaid shipment OLD-WB cancelled/);
  });
  test('booked Ekart 2 parcel is cancelled with account 2', async () => {
    put('ord1', { carrier: 'EKART', ekartAccount: 2 });
    await orders.cancelShipmentForCancelledOrder('ord1', 'admin@x.in');
    assert.equal(cancelCalls()[0]!.auth, `Bearer tok-${E2.id}`);
  });
  test('carrier refuses -> shipment left as is and the admin is told to cancel on the dashboard', async () => {
    put('ord1', { carrier: 'DELHIVERY' });
    delhiveryCancel = () => json({ status: false, remark: 'Already picked up' });
    await orders.cancelShipmentForCancelledOrder('ord1', 'admin@x.in');
    assert.equal(fake.shipments.get('ord1')!.status, 'BOOKED');
    assert.match(fake.logs.at(-1)!.note, /NOT cancelled: Already picked up.*cancel OLD-WB on the carrier dashboard/);
  });
  test('parcel already in transit -> no cancel call, note says arrange RTO', async () => {
    put('ord1', { carrier: 'EKART', ekartAccount: 1, status: 'IN_TRANSIT' });
    await orders.cancelShipmentForCancelledOrder('ord1', 'admin@x.in');
    assert.equal(cancelCalls().length, 0);
    assert.match(fake.logs.at(-1)!.note, /already IN_TRANSIT.*RTO/);
  });
  test('delivered / failed / returned parcels are left alone silently', async () => {
    for (const status of ['DELIVERED', 'FAILED', 'RETURNED']) {
      put('ord1', { status });
      await orders.cancelShipmentForCancelledOrder('ord1', 'a');
    }
    assert.equal(cancelCalls().length, 0);
    assert.equal(fake.logs.length, 0);
  });
  test('no shipment / no waybill -> nothing happens', async () => {
    await orders.cancelShipmentForCancelledOrder('ord1', 'a');
    put('ord1', { delhiveryWaybill: null, status: 'PENDING' });
    await orders.cancelShipmentForCancelledOrder('ord1', 'a');
    assert.equal(calls.length, 0);
  });
  test('never throws, even if the carrier call explodes', async () => {
    put('ord1', { carrier: 'EKART', ekartAccount: 1 });
    ekartCancel = () => { throw new Error('boom'); };
    await assert.doesNotReject(orders.cancelShipmentForCancelledOrder('ord1', 'a'));
  });
});

describe('rebookOrderShipment (switch provider)', () => {
  test('Delhivery -> Ekart 1: cancels the Delhivery waybill, books Ekart 1, records everything', async () => {
    put('ord1', { carrier: 'DELHIVERY', delhiveryWaybill: 'DW-OLD' });
    const r = await orders.rebookOrderShipment('ord1', 'EKART_1', 'admin@x.in');
    assert.deepEqual(r, { waybill: 'EK-TRACK-1', carrier: 'EKART', ekartAccount: 1 });
    assert.equal(cancelCalls().length, 1);
    assert.deepEqual(JSON.parse(cancelCalls()[0]!.body), { waybill: 'DW-OLD', cancellation: 'true' });
    const sh = fake.shipments.get('ord1')!;
    assert.equal(sh.carrier, 'EKART');
    assert.equal(sh.ekartAccount, 1);
    assert.equal(sh.delhiveryWaybill, 'EK-TRACK-1');
    assert.equal(sh.status, 'BOOKED');
    const notes = fake.logs.map((l) => l.note);
    assert.ok(notes.some((n) => /Shipment DW-OLD \(Delhivery\) cancelled to switch provider/.test(n)));
    assert.ok(notes.some((n) => /Re-booked on Ekart 1 - Prepaid: waybill EK-TRACK-1/.test(n)));
    assert.ok(fake.logs.every((l) => l.createdBy === 'admin@x.in'));
  });
  test('the cancel happens BEFORE the new booking', async () => {
    put('ord1', { carrier: 'DELHIVERY' });
    await orders.rebookOrderShipment('ord1', 'EKART_1', 'a');
    const iCancel = calls.findIndex((c) => c.url.includes('/api/p/edit'));
    const iBook = calls.findIndex((c) => c.url.includes('/package/create'));
    assert.ok(iCancel >= 0 && iBook > iCancel);
  });
  test('Ekart 2 -> Delhivery: cancels with account 2, books Delhivery', async () => {
    put('ord1', { carrier: 'EKART', ekartAccount: 2, delhiveryWaybill: 'EK-OLD' });
    const r = await orders.rebookOrderShipment('ord1', 'DELHIVERY', 'a');
    assert.equal(r.carrier, 'DELHIVERY');
    assert.equal(cancelCalls()[0]!.auth, `Bearer tok-${E2.id}`);
    assert.equal(fake.shipments.get('ord1')!.ekartAccount, null);
  });
  test('Ekart 1 -> Ekart 2 works (account switch)', async () => {
    put('ord1', { carrier: 'EKART', ekartAccount: 1, delhiveryWaybill: 'EK-OLD' });
    const r = await orders.rebookOrderShipment('ord1', 'EKART_2', 'a');
    assert.equal(r.ekartAccount, 2);
    assert.equal(cancelCalls()[0]!.auth, `Bearer tok-${E1.id}`);
    assert.equal(ekartCalls()[0]!.auth, `Bearer tok-${E2.id}`);
  });
  test('cancel fails -> nothing changes and no new booking is made', async () => {
    put('ord1', { carrier: 'DELHIVERY', delhiveryWaybill: 'DW-OLD' });
    delhiveryCancel = () => json({ status: false, remark: 'Cannot cancel' });
    await assert.rejects(orders.rebookOrderShipment('ord1', 'EKART_1', 'a'), /Could not cancel the existing Delhivery shipment \(Cannot cancel\)\. Nothing was changed/);
    assert.equal(ekartCalls().length, 0);
    const sh = fake.shipments.get('ord1')!;
    assert.equal(sh.delhiveryWaybill, 'DW-OLD');
    assert.equal(sh.carrier, 'DELHIVERY');
    assert.equal(fake.logs.length, 0);
  });
  test('Ekart cannot serve the pincode -> blocked BEFORE cancelling the working booking', async () => {
    put('ord1', { carrier: 'DELHIVERY' });
    serviceability = () => json({ status: false, remark: 'Pincode is not serviceable' });
    await assert.rejects(orders.rebookOrderShipment('ord1', 'EKART_1', 'a'), /Ekart 1 - Prepaid does not deliver to 110001\. Nothing was changed/);
    assert.equal(cancelCalls().length, 0);
    assert.equal(fake.shipments.get('ord1')!.delhiveryWaybill, 'OLD-WB');
  });
  test('Ekart serviceability cannot be confirmed -> blocked before cancelling', async () => {
    put('ord1', { carrier: 'DELHIVERY' });
    serviceability = () => json({}, 500);
    await assert.rejects(orders.rebookOrderShipment('ord1', 'EKART_1', 'a'), /Could not confirm.*Nothing was changed/);
    assert.equal(cancelCalls().length, 0);
  });
  test('COD order where the Ekart account has no COD at the pincode -> blocked before cancelling', async () => {
    fake.order = makeOrder('COD');
    put('ord1', { carrier: 'DELHIVERY' });
    serviceability = () => json({ status: true, remark: 'ok', details: { cod: false, forward_drop: true } });
    await assert.rejects(orders.rebookOrderShipment('ord1', 'EKART_2', 'a'), /does not offer cash on delivery/);
    assert.equal(cancelCalls().length, 0);
  });
  test('new booking fails after the cancel -> clear error, shipment cleared so Book can be retried, failure logged', async () => {
    put('ord1', { carrier: 'DELHIVERY', delhiveryWaybill: 'DW-OLD' });
    ekartCreate = () => json({ remark: 'Insufficient wallet balance' }, 400);
    await assert.rejects(orders.rebookOrderShipment('ord1', 'EKART_1', 'a'), /The old Delhivery shipment was cancelled, but the new booking failed.*wallet.*Book again/);
    const sh = fake.shipments.get('ord1')!;
    assert.equal(sh.delhiveryWaybill, null);
    assert.equal(sh.status, 'PENDING');
    assert.ok(fake.logs.some((l) => /New booking after switch failed/.test(l.note)));
    // ...and the admin can now book normally.
    ekartCreate = () => json({ status: true, tracking_id: 'EK-RETRY' });
    assert.equal((await orders.bookOrderShipment('ord1', 'EKART_1')).waybill, 'EK-RETRY');
  });
  test('after a switch the new booking uses a -R1 reference (carriers reject reused references)', async () => {
    put('ord1', { carrier: 'DELHIVERY' });
    await orders.rebookOrderShipment('ord1', 'EKART_1', 'a');
    assert.equal(JSON.parse(ekartCalls()[0]!.body).order_number, 'DOSH-TEST-0001-R1');
  });
  test('a first, normal booking keeps the plain order number', async () => {
    await orders.bookOrderShipment('ord1', 'EKART_1');
    assert.equal(JSON.parse(ekartCalls()[0]!.body).order_number, 'DOSH-TEST-0001');
  });
  test('parcel already picked up (not BOOKED) cannot be switched', async () => {
    put('ord1', { carrier: 'DELHIVERY', status: 'IN_TRANSIT' });
    await assert.rejects(orders.rebookOrderShipment('ord1', 'EKART_1', 'a'), /already in transit.*NDR \/ RTO/);
    assert.equal(cancelCalls().length, 0);
  });
  test('cancelled / delivered orders cannot be switched', async () => {
    for (const status of ['CANCELLED', 'DELIVERED', 'REFUNDED', 'PENDING_PAYMENT']) {
      fake.order = makeOrder('PREPAID', { status });
      put('ord1', { carrier: 'DELHIVERY' });
      await assert.rejects(orders.rebookOrderShipment('ord1', 'EKART_1', 'a'), /Cannot switch/, status);
    }
    assert.equal(cancelCalls().length, 0);
  });
  test('order with no shipment yet just books on the chosen provider', async () => {
    const r = await orders.rebookOrderShipment('ord1', 'EKART_2', 'a');
    assert.equal(r.ekartAccount, 2);
    assert.equal(cancelCalls().length, 0);
  });
  test('stale booking cost is cleared on switch and re-quoted for the new provider', async () => {
    put('ord1', { carrier: 'DELHIVERY' });
    await orders.rebookOrderShipment('ord1', 'EKART_1', 'a');
    assert.equal(fake.orderUpdates[0]!.bookingShippingCost, null);
    assert.equal(fake.orderUpdates.at(-1)!.bookingShippingCost, 50.74);
  });
});

describe('switchDelhiveryBookingsToEkart (bulk)', () => {
  const addOrder = (id: string, over: { cod?: boolean; pincode?: string; status?: string } = {}) => {
    const o = { ...makeOrder(over.cod ? 'COD' : 'PREPAID', { status: over.status ?? 'PAID', shippingAddress: { line1: 'a', city: 'c', state: 's', pincode: over.pincode ?? '110001' } }), id, orderNumber: `DOSH-${id}` };
    fake.orderMap.set(id, o);
    put(id, { carrier: 'DELHIVERY', delhiveryWaybill: `DW-${id}` });
  };

  test('dry run reports eligible / skipped and changes nothing', async () => {
    addOrder('a'); addOrder('b', { cod: true }); addOrder('c', { pincode: '744101' });
    serviceability = (pin) => (pin === '744101' ? json({ status: false, remark: 'Pincode is not serviceable' }) : json({ status: true, remark: 'ok', details: { cod: true, forward_drop: true } }));
    const r = await orders.switchDelhiveryBookingsToEkart({ dryRun: true, limit: 15, admin: 'a' });
    assert.equal(r.eligible, 3);
    assert.equal(r.switched, 2);
    assert.equal(r.skipped.length, 1);
    assert.match(r.skipped[0]!.reason, /does not deliver to 744101/);
    assert.equal(cancelCalls().length, 0);
    assert.equal(fake.shipments.get('a')!.carrier, 'DELHIVERY');
  });
  test('apply: prepaid -> Ekart 1, COD -> Ekart 2, unserviceable stays on Delhivery', async () => {
    addOrder('a'); addOrder('b', { cod: true }); addOrder('c', { pincode: '744101' });
    serviceability = (pin) => (pin === '744101' ? json({ status: false, remark: 'Pincode is not serviceable' }) : json({ status: true, remark: 'ok', details: { cod: true, forward_drop: true } }));
    const r = await orders.switchDelhiveryBookingsToEkart({ dryRun: false, limit: 15, admin: 'a' });
    assert.equal(r.switched, 2);
    assert.equal(r.failed.length, 0);
    assert.equal(fake.shipments.get('a')!.ekartAccount, 1);
    assert.equal(fake.shipments.get('b')!.ekartAccount, 2);
    assert.equal(fake.shipments.get('c')!.carrier, 'DELHIVERY');
    assert.equal(fake.shipments.get('c')!.delhiveryWaybill, 'DW-c');
  });
  test('batch limit: processes only `limit` and reports the rest', async () => {
    for (const id of ['a', 'b', 'c']) addOrder(id);
    const r = await orders.switchDelhiveryBookingsToEkart({ dryRun: false, limit: 2, admin: 'a' });
    assert.equal(r.switched, 2);
    assert.equal(r.remaining, 1);
    const again = await orders.switchDelhiveryBookingsToEkart({ dryRun: false, limit: 2, admin: 'a' });
    assert.equal(again.eligible, 1);
    assert.equal(again.switched, 1);
    assert.equal(again.remaining, 0);
  });
  test('orders already picked up / shipped / cancelled are not touched', async () => {
    addOrder('a', { status: 'SHIPPED' }); addOrder('b', { status: 'CANCELLED' }); addOrder('c');
    put('c', { carrier: 'DELHIVERY', status: 'IN_TRANSIT' });
    const r = await orders.switchDelhiveryBookingsToEkart({ dryRun: false, limit: 15, admin: 'a' });
    assert.equal(r.eligible, 0);
    assert.equal(cancelCalls().length, 0);
  });
  test('Ekart parcels are never touched by the bulk switch', async () => {
    addOrder('a');
    put('a', { carrier: 'EKART', ekartAccount: 1 });
    assert.equal((await orders.switchDelhiveryBookingsToEkart({ dryRun: false, limit: 15, admin: 'a' })).eligible, 0);
  });
  test('one failure does not stop the rest; it is reported', async () => {
    addOrder('a'); addOrder('b');
    let n = 0;
    delhiveryCancel = () => (++n === 1 ? json({ status: false, remark: 'Cannot cancel' }) : json({ status: true }));
    const r = await orders.switchDelhiveryBookingsToEkart({ dryRun: false, limit: 15, admin: 'a' });
    assert.equal(r.failed.length, 1);
    assert.equal(r.switched, 1);
    assert.match(r.failed[0]!.error, /Nothing was changed/);
  });
  test('serviceability unknown -> skipped, never cancelled', async () => {
    addOrder('a');
    serviceability = () => json({}, 500);
    const r = await orders.switchDelhiveryBookingsToEkart({ dryRun: false, limit: 15, admin: 'a' });
    assert.equal(r.skipped.length, 1);
    assert.equal(cancelCalls().length, 0);
  });
});

describe('cancel uses the booking account', () => {
  test('cancelEkartShipment(1) authenticates as account 1', async () => {
    await ekart.cancelEkartShipment(1, 'TRK');
    const cancel = calls.find((c) => c.url.includes('/package/cancel'))!;
    assert.equal(cancel.auth, `Bearer tok-${E1.id}`);
  });
  test('cancelEkartShipment(2) authenticates as account 2', async () => {
    await ekart.cancelEkartShipment(2, 'TRK');
    const cancel = calls.find((c) => c.url.includes('/package/cancel'))!;
    assert.equal(cancel.auth, `Bearer tok-${E2.id}`);
  });
  test('unconfigured account -> clean failure', async () => {
    env.EKART1_USERNAME = '';
    const r = await ekart.cancelEkartShipment(1, 'TRK');
    assert.equal(r.success, false);
  });
});

describe('mapEkartStatus', () => {
  const cases: Array<[string, string | undefined, string]> = [
    ['Order Placed', undefined, 'BOOKED'], ['Pickup Scheduled', undefined, 'BOOKED'],
    ['Picked Up', undefined, 'IN_TRANSIT'], ['In Transit', undefined, 'IN_TRANSIT'],
    ['Out for Delivery', undefined, 'OUT_FOR_DELIVERY'], ['Delivered', undefined, 'DELIVERED'],
    ['Undelivered', undefined, 'FAILED'], ['Lost', undefined, 'FAILED'],
    ['RTO In Transit', undefined, 'RETURNED'], ['RTO Delivered', undefined, 'RETURNED'],
    ['Something New', undefined, 'IN_TRANSIT'],
    ['In Transit', 'Customer not available', 'FAILED'], // NDR on in-flight parcel
    ['Delivered', 'old ndr', 'DELIVERED'], ['RTO In Transit', 'ndr', 'RETURNED'],
  ];
  for (const [s, ndr, want] of cases) test(`${s}${ndr ? ` + ndr` : ''} -> ${want}`, () => assert.equal(webhooks.mapEkartStatus(s, ndr), want));
});

describe('ekart webhook controller', () => {
  function run(query: Record<string, string>, body: unknown) {
    const out: { code?: number; payload?: unknown } = {};
    const reply = {
      code(c: number) { out.code = c; return this; },
      send(p: unknown) { out.payload = out.payload ?? p; return this; },
    };
    return controller.ekartWebhookHandler({ query, body } as never, reply as never).then(() => out);
  }
  const ping = { id: 'NO-SUCH-WAYBILL', status: 'In Transit', location: 'X', desc: 'd', ctime: 1793090039000, edd: 1793167200000 };

  test('no token -> 401', async () => assert.equal((await run({}, ping)).code, 401));
  test('wrong token -> 401', async () => assert.equal((await run({ token: 'nope' }, ping)).code, 401));
  test('same length wrong token -> 401', async () => assert.equal((await run({ token: 'x'.repeat(E1.hook.length) }, ping)).code, 401));
  test('empty token never matches an unset account token', async () => {
    env.EKART1_WEBHOOK_TOKEN = '';
    assert.equal((await run({ token: '' }, ping)).code, 401);
  });
  test('account 1 token accepted', async () => assert.equal((await run({ token: E1.hook }, ping)).code, 200));
  test('account 2 token accepted', async () => assert.equal((await run({ token: E2.hook }, ping)).code, 200));
  test('shipment_created style payload (no status) -> 200 ignored', async () => {
    const r = await run({ token: E1.hook }, { id: 'W1', orderNumber: 'X' });
    assert.equal(r.code, 200);
    assert.deepEqual(r.payload, { status: 'ignored' });
  });
  test('empty body -> 200 ignored (no retry storm)', async () => assert.equal((await run({ token: E1.hook }, undefined)).code, 200));
});

describe('handleEkartStatusUpdate', () => {
  test('unknown waybill is a no-op', async () => {
    await webhooks.handleEkartStatusUpdate('NOPE', { status: 'In Transit', location: '', description: '', timestamp: new Date().toISOString() });
  });
});
