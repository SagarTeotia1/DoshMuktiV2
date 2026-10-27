// Run: npx tsx --env-file=.env --test tests/whatsapp.test.mts
// WhatsApp order confirmation (MSG91). Fake fetch + fake Prisma: nothing is sent, no DB touched.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

interface FakeOrder { id: string; orderNumber: string; customerName: string; customerPhone: string; publicToken: string; createdAt: Date; whatsappConfirmSentAt: Date | null }
const store = { order: null as FakeOrder | null, failFind: false };
const fakeDb = {
  order: {
    findUnique: async () => { if (store.failFind) throw new Error('db down'); return store.order ? { ...store.order } : null; },
    update: async ({ data }: { data: Partial<FakeOrder> }) => { Object.assign(store.order!, data); return store.order; },
    updateMany: async ({ where, data }: { where: { id: string; whatsappConfirmSentAt?: null }; data: Partial<FakeOrder> }) => {
      const o = store.order;
      if (!o || o.id !== where.id) return { count: 0 };
      if ('whatsappConfirmSentAt' in where && where.whatsappConfirmSentAt === null && o.whatsappConfirmSentAt !== null) return { count: 0 };
      Object.assign(o, data); // check-and-set in one step, like a single SQL UPDATE ... WHERE
      await Promise.resolve(); // then yield, like a real round trip, so callers genuinely interleave
      return { count: 1 };
    },
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakeDb;

interface Call { url: string; headers: Record<string, string>; body: any }
let calls: Call[] = [];
let respond: () => Response | Promise<Response> = () => ok();
const ok = () => new Response(JSON.stringify({ status: 'success', request_id: 'req-1' }), { status: 200 });
globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
  calls.push({ url: String(url), headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
  return respond();
}) as typeof fetch;

const { env } = await import('../src/config/env');
const wa = await import('../src/shared/integrations/msg91/whatsapp');
const svc = await import('../src/shared/notifications/orderWhatsApp');
const est = await import('../src/shared/shipping/deliveryEstimate');

const params = { phone: '9319811170', customerName: 'Sagar Teotia', orderNumber: 'DOSH-20261027-0042', deliveryText: '31 Oct - 3 Nov 2026', publicToken: 'abcdef0123456789' };

beforeEach(() => {
  Object.assign(env, { MSG91_WHATSAPP_AUTH_KEY: 'key', MSG91_WHATSAPP_NUMBER: '15553738120', MSG91_WHATSAPP_NAMESPACE: 'ns_1', MSG91_WHATSAPP_ORDER_TEMPLATE: 'dosh_order_confirm' });
  calls = [];
  respond = ok;
  store.failFind = false;
  store.order = { id: 'o1', orderNumber: 'DOSH-20261027-0042', customerName: 'Sagar Teotia', customerPhone: '9319811170', publicToken: 'abcdef0123456789', createdAt: new Date('2026-10-27T06:00:00Z'), whatsappConfirmSentAt: null };
});

describe('toWhatsAppNumber', () => {
  test('accepts common Indian formats', () => {
    for (const p of ['9319811170', '+919319811170', '919319811170', '93198 11170', '+91 93198-11170', '09319811170'.slice(1)]) assert.equal(wa.toWhatsAppNumber(p), '919319811170', p);
  });
  test('rejects bad numbers', () => {
    for (const p of ['', '12345', '5319811170', '+14155550123', '93198111700', 'abc', '9319811170123']) assert.equal(wa.toWhatsAppNumber(p), null, p);
  });
});

describe('cleanTemplateText', () => {
  test('strips newlines/tabs/multi-spaces and caps length', () => {
    assert.equal(wa.cleanTemplateText('a\nb\t\tc    d'), 'a b c d');
    assert.equal(wa.cleanTemplateText('x'.repeat(100), 10), 'xxxxxxxxxx');
  });
  test('never returns an empty param (WhatsApp rejects empty)', () => assert.equal(wa.cleanTemplateText('  \n '), '-'));
});

describe('payload', () => {
  // Built inside each test: env is set by beforeEach, after describe bodies run.
  const build = () => {
    const p = wa.buildOrderConfirmationPayload(params, '919319811170');
    const tpl = p.payload.template;
    return { p, tpl, c: tpl.to_and_components[0]!.components };
  };
  test('matches the approved template contract', () => {
    const { p, tpl } = build();
    assert.equal(p.integrated_number, '15553738120');
    assert.equal(p.content_type, 'template');
    assert.equal(tpl.name, 'dosh_order_confirm');
    assert.equal(tpl.namespace, 'ns_1');
    assert.deepEqual(tpl.language, { code: 'en', policy: 'deterministic' });
    assert.deepEqual(tpl.to_and_components[0]!.to, ['919319811170']);
  });
  test('body_1 first name, body_2 order no, body_3 delivery window', () => {
    const { c } = build();
    assert.deepEqual(c.body_1, { type: 'text', value: 'Sagar' });
    assert.deepEqual(c.body_2, { type: 'text', value: 'DOSH-20261027-0042' });
    assert.deepEqual(c.body_3, { type: 'text', value: '31 Oct - 3 Nov 2026' });
  });
  test('button opens https://doshmukti.com/track/<token>', () => {
    const { c } = build();
    assert.deepEqual(c.button_1, { subtype: 'url', type: 'text', value: 'track/abcdef0123456789' });
  });
  test('token is URL-encoded', () => {
    const q = wa.buildOrderConfirmationPayload({ ...params, publicToken: 'a b/c' }, '91x').payload.template.to_and_components[0]!.components;
    assert.equal(q.button_1.value, 'track/a%20b%2Fc');
  });
});

describe('sendOrderConfirmationWhatsApp', () => {
  test('success: posts to MSG91 with authkey and returns request id', async () => {
    const r = await wa.sendOrderConfirmationWhatsApp(params);
    assert.deepEqual(r, { ok: true, requestId: 'req-1' });
    assert.equal(calls[0]!.url, 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/');
    assert.equal(calls[0]!.headers.authkey, 'key');
  });
  test('unconfigured -> no HTTP', async () => {
    env.MSG91_WHATSAPP_AUTH_KEY = '';
    const r = await wa.sendOrderConfirmationWhatsApp(params);
    assert.equal(r.ok, false);
    assert.equal(calls.length, 0);
  });
  test('invalid number -> no HTTP, not retryable', async () => {
    const r = await wa.sendOrderConfirmationWhatsApp({ ...params, phone: '12345' });
    assert.deepEqual(r, { ok: false, error: 'Not a valid Indian mobile number', retryable: false });
    assert.equal(calls.length, 0);
  });
  test('apiError 418 explains the IP allow-list, not retryable', async () => {
    respond = () => new Response(JSON.stringify({ status: 'fail', hasError: true, errors: 'Unauthorized', code: '401', apiError: '418' }), { status: 401 });
    const r = await wa.sendOrderConfirmationWhatsApp(params);
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /IP not allow-listed/);
    assert.equal((r as { retryable: boolean }).retryable, false);
  });
  test('HTTP 200 with status:fail is a failure', async () => {
    respond = () => new Response(JSON.stringify({ status: 'fail', errors: 'Template not found' }), { status: 200 });
    const r = await wa.sendOrderConfirmationWhatsApp(params);
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /Template not found/);
  });
  test('5xx and 429 are retryable', async () => {
    for (const status of [500, 502, 429]) {
      respond = () => new Response('{}', { status });
      assert.equal(((await wa.sendOrderConfirmationWhatsApp(params)) as { retryable: boolean }).retryable, true, String(status));
    }
  });
  test('network error is retryable and does not throw', async () => {
    respond = () => { throw new TypeError('fetch failed'); };
    const r = await wa.sendOrderConfirmationWhatsApp(params);
    assert.deepEqual(r, { ok: false, error: 'fetch failed', retryable: true });
  });
  test('non-JSON body is a failure', async () => {
    respond = () => new Response('<html>', { status: 200 });
    assert.equal((await wa.sendOrderConfirmationWhatsApp(params)).ok, false);
  });
});

describe('formatDeliveryWindowText', () => {
  test('IST dates, from-day to full date', () => {
    const w = est.estimateDeliveryWindow(new Date('2026-10-27T06:00:00Z'), 'PAID')!;
    assert.match(est.formatDeliveryWindowText(w), /^\d{1,2} \w{3} - \d{1,2} \w{3} 2026$/);
  });
  test('uses India time near midnight UTC', () => {
    // 20:00 UTC on the 31st is already 01:30 IST on 1 Nov.
    const text = est.formatDeliveryWindowText({ from: '2026-10-31T20:00:00Z', to: '2026-11-03T20:00:00Z' });
    assert.equal(text.replace(/ /g, ' '), '1 Nov - 4 Nov 2026');
  });
});

describe('sendOrderWhatsAppConfirmation', () => {
  test('sends once and marks the order', async () => {
    assert.deepEqual(await svc.sendOrderWhatsAppConfirmation('o1'), { outcome: 'sent' });
    assert.equal(calls.length, 1);
    assert.ok(store.order!.whatsappConfirmSentAt instanceof Date);
    const comps = calls[0]!.body.payload.template.to_and_components[0].components;
    assert.equal(comps.body_2.value, 'DOSH-20261027-0042');
    assert.equal(comps.button_1.value, 'track/abcdef0123456789');
  });
  test('webhook replay / second trigger does not message again', async () => {
    await svc.sendOrderWhatsAppConfirmation('o1');
    assert.deepEqual(await svc.sendOrderWhatsAppConfirmation('o1'), { outcome: 'already_sent' });
    assert.equal(calls.length, 1);
  });
  test('two racing triggers send exactly one message', async () => {
    const results = await Promise.all([svc.sendOrderWhatsAppConfirmation('o1'), svc.sendOrderWhatsAppConfirmation('o1'), svc.sendOrderWhatsAppConfirmation('o1')]);
    assert.equal(results.filter((r) => r.outcome === 'sent').length, 1);
    assert.equal(results.filter((r) => r.outcome === 'already_sent').length, 2);
    assert.equal(calls.length, 1);
  });
  test('permanent failure releases the claim so it can be retried, with the reason', async () => {
    respond = () => new Response(JSON.stringify({ status: 'fail', errors: 'Unauthorized', apiError: '418' }), { status: 401 });
    const r = await svc.sendOrderWhatsAppConfirmation('o1');
    assert.equal(r.outcome, 'failed');
    assert.match(r.error!, /418/);
    assert.equal(store.order!.whatsappConfirmSentAt, null);
    assert.equal(calls.length, 1); // 401 is not retried
    respond = ok;
    assert.deepEqual(await svc.sendOrderWhatsAppConfirmation('o1'), { outcome: 'sent' });
  });
  test('transient failure is retried once and succeeds', async () => {
    let n = 0;
    respond = () => (++n === 1 ? new Response('{}', { status: 503 }) : ok());
    assert.deepEqual(await svc.sendOrderWhatsAppConfirmation('o1'), { outcome: 'sent' });
    assert.equal(calls.length, 2);
    assert.ok(store.order!.whatsappConfirmSentAt);
  });
  test('transient failure twice -> failed and claim released', async () => {
    respond = () => new Response('{}', { status: 503 });
    assert.equal((await svc.sendOrderWhatsAppConfirmation('o1')).outcome, 'failed');
    assert.equal(calls.length, 2);
    assert.equal(store.order!.whatsappConfirmSentAt, null);
  });
  test('force (admin resend) sends again even after a success', async () => {
    await svc.sendOrderWhatsAppConfirmation('o1');
    assert.deepEqual(await svc.sendOrderWhatsAppConfirmation('o1', { force: true }), { outcome: 'sent' });
    assert.equal(calls.length, 2);
  });
  test('disabled when not configured, order untouched', async () => {
    env.MSG91_WHATSAPP_NAMESPACE = '';
    assert.deepEqual(await svc.sendOrderWhatsAppConfirmation('o1'), { outcome: 'disabled' });
    assert.equal(store.order!.whatsappConfirmSentAt, null);
    assert.equal(calls.length, 0);
  });
  test('unknown order', async () => {
    store.order = null;
    assert.deepEqual(await svc.sendOrderWhatsAppConfirmation('nope'), { outcome: 'order_not_found' });
  });
  test('bad phone on the order fails cleanly and does not mark it sent', async () => {
    store.order!.customerPhone = '12345';
    const r = await svc.sendOrderWhatsAppConfirmation('o1');
    assert.equal(r.outcome, 'failed');
    assert.equal(store.order!.whatsappConfirmSentAt, null);
  });
  test('DB error before the claim never clears an earlier send marker', async () => {
    const earlier = new Date('2026-10-27T07:00:00Z');
    store.order!.whatsappConfirmSentAt = earlier;
    store.failFind = true;
    const r = await svc.sendOrderWhatsAppConfirmation('o1');
    assert.equal(r.outcome, 'failed');
    assert.deepEqual(store.order!.whatsappConfirmSentAt, earlier);
    assert.equal(calls.length, 0);
  });
  test('never throws', async () => {
    respond = () => { throw new Error('boom'); };
    await assert.doesNotReject(svc.sendOrderWhatsAppConfirmation('o1'));
  });
});
