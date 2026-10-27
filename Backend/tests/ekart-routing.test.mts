// Run: npx tsx --env-file=.env --test tests/ekart-routing.test.mts
// No network, no real DB: global fetch and the Prisma singleton are faked before the app code loads.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

interface FakeShipment { orderId: string; delhiveryWaybill: string | null; carrier: string; ekartAccount: number | null; status: string }
const fake = {
  order: null as Record<string, unknown> | null,
  shipments: new Map<string, FakeShipment>(),
};
const fakeDb = {
  order: { findUnique: async () => fake.order, update: async () => { throw new Error('not faked'); } },
  shipment: {
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
  if (url.includes('/api/v1/package/create')) return ekartCreate();
  if (url.includes('/api/cmu/create.json')) return delhiveryCreate();
  if (url.includes('/api/v1/package/cancel')) return json({ status: true });
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
    assert.equal(carrier.computeCodFee('COD', 0), 50);
    assert.equal(carrier.computeCodFee('COD', 90), 0);
    assert.equal(carrier.computeCodFee('PREPAID', 0), 0);
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
    assert.deepEqual(r, { waybill: 'EK-TRACK-1', carrier: 'EKART' });
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
    assert.deepEqual(r, { waybill: 'DL-WB-1', carrier: 'DELHIVERY' });
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
    await assert.rejects(orders.bookOrderShipment('ord1'), /EKART1: Insufficient wallet balance.*no fallback/);
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
    await assert.rejects(orders.bookOrderShipment('ord1'), /EKART1: not configured/);
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
    await assert.rejects(orders.bookOrderShipment('ord1'), /EKART1: Pincode not serviceable \| DELHIVERY: Invalid PIN/);
    assert.equal(fake.shipments.size, 0);
  });
  test('unserviceable + Delhivery not configured -> throws', async () => {
    ekartCreate = () => json({ remark: 'Pincode not serviceable' }, 400);
    env.DELHIVERY_API_KEY = '';
    await assert.rejects(orders.bookOrderShipment('ord1'), /DELHIVERY not configured/);
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
