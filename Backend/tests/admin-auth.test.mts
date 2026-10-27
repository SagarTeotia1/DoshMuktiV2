// Run: npx tsx --env-file=.env --test tests/admin-auth.test.mts
// Admin routes must accept admin tokens only. Customer tokens share the signing key, so the
// role claim is what keeps customers out. Uses the real app in-process; no network calls are
// made (backups are forced to "not configured" so nothing reaches R2).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { buildApp } = await import('../src/app');
const { env } = await import('../src/config/env');

let app: Awaited<ReturnType<typeof buildApp>>;
before(async () => {
  env.BACKUP_R2_BUCKET = '';
  env.BACKUP_ENCRYPTION_KEY = '';
  app = await buildApp();
});
after(async () => {
  await app.close();
});

const sign = (payload: object, opts: { expiresIn: string } = { expiresIn: '5m' }) => app.jwt.sign(payload, opts);
const get = (url: string, token?: string) =>
  app.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} });

describe('verifyAdmin', () => {
  test('no token -> 401', async () => assert.equal((await get('/api/admin/backups')).statusCode, 401));
  test('garbage token -> 401', async () => assert.equal((await get('/api/admin/backups', 'not.a.jwt')).statusCode, 401));
  test('expired admin token -> 401', async () => {
    const now = Math.floor(Date.now() / 1000);
    const t = app.jwt.sign({ sub: 'a@b.c', role: 'admin', iat: now - 600, exp: now - 60 });
    assert.equal((await get('/api/admin/backups', t)).statusCode, 401);
  });
  test('token signed with a different secret -> 401', async () => {
    const forged = (await import('node:crypto')).createHmac('sha256', 'wrong-secret');
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'a@b.c', role: 'admin', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
    const t = `${head}.${body}.${forged.update(`${head}.${body}`).digest('base64url')}`;
    assert.equal((await get('/api/admin/backups', t)).statusCode, 401);
  });
  test('CUSTOMER token -> 403 (was 200: any customer could use admin APIs)', async () => {
    const t = sign({ sub: 'cust-1', phone: '9999999999', role: 'customer' });
    assert.equal((await get('/api/admin/backups', t)).statusCode, 403);
  });
  test('token with no role -> 403', async () => assert.equal((await get('/api/admin/backups', sign({ sub: 'x' }))).statusCode, 403));
  test('role other than admin -> 403', async () => assert.equal((await get('/api/admin/backups', sign({ sub: 'x', role: 'superuser' }))).statusCode, 403));
  test('admin token -> 200', async () => {
    const res = await get('/api/admin/backups', sign({ sub: 'admin@example.com', role: 'admin' }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().configured, false);
  });
});

describe('other admin entry points reject customers too', () => {
  const customer = () => sign({ sub: 'cust-1', phone: '9999999999', role: 'customer' });
  const admin = () => sign({ sub: 'admin@example.com', role: 'admin' });
  for (const [method, url] of [
    ['GET', '/api/admin/orders'],
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/users'],
    ['POST', '/api/admin/backups/run'],
    ['POST', '/api/admin/orders/x/whatsapp-confirmation'],
    ['POST', '/api/admin/orders/x/shipment/book'],
    ['POST', '/api/admin/orders/x/shipment/rebook'],
    ['POST', '/api/admin/orders/shipments/switch-to-ekart'],
  ] as const) {
    test(`${method} ${url}: customer 403, anonymous 401`, async () => {
      const as = (token?: string) => app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: method === 'POST' ? {} : undefined });
      assert.equal((await as(customer())).statusCode, 403);
      assert.equal((await as()).statusCode, 401);
    });
  }
  test('admin token passes the gate on the same routes (not 401/403)', async () => {
    // Only the guard is asserted: POST /backups/run is safe here because backups are unconfigured (503).
    const res = await app.inject({ method: 'POST', url: '/api/admin/backups/run', headers: { authorization: `Bearer ${admin()}` }, payload: {} });
    assert.equal(res.statusCode, 503);
  });
});
