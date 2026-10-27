// Run: npx tsx --env-file=.env --test tests/backup.test.mts
// Pure backup logic: encryption format, retention, FK ordering, identifier safety. No network, no DB.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  BackupFormatError, decryptBackup, encryptBackup, parseBackupKey, type BackupPayload,
} from '../src/shared/backup/format';
import {
  assertSafeIdentifier, backupObjectKey, chunk, selectBackupsToDelete, sortTablesByDependency, type StoredBackup,
} from '../src/shared/backup/plan';

const KEY_HEX = crypto.randomBytes(32).toString('hex');
const key = parseBackupKey(KEY_HEX);
const payload: BackupPayload = {
  manifest: { version: 1, createdAt: '2026-10-27T00:00:00.000Z', serverVersion: '18.6', migrations: ['m1', 'm2'], tables: { Order: 2, User: 1 } },
  data: {
    Order: [
      { id: 'o1', total: 499.5, status: 'PAID', shippingAddress: { line1: 'अ 1', pincode: '110085' }, purpose: ['love', 'wealth'], note: null },
      { id: 'o2', total: 90, status: 'COD', shippingAddress: {}, purpose: [], note: 'x' },
    ],
    User: [{ id: 'u1', phone: '9876543210', createdAt: '2026-10-27T10:00:00+00:00' }],
  },
};

describe('backup file format', () => {
  test('round trip returns identical payload (incl. unicode, nulls, arrays, nested json)', () => {
    assert.deepEqual(decryptBackup(encryptBackup(payload, key), key), payload);
  });
  test('two encryptions of the same payload differ (random IV)', () => {
    assert.notDeepEqual(encryptBackup(payload, key), encryptBackup(payload, key));
  });
  test('ciphertext does not contain plaintext', () => {
    const file = encryptBackup(payload, key);
    assert.equal(file.includes(Buffer.from('9876543210')), false);
    assert.equal(file.includes(Buffer.from('110085')), false);
  });
  test('wrong key is rejected with a clear error', () => {
    const other = crypto.randomBytes(32);
    assert.throws(() => decryptBackup(encryptBackup(payload, key), other), BackupFormatError);
  });
  test('any flipped byte is detected (header, iv, tag, body)', () => {
    const file = encryptBackup(payload, key);
    for (const i of [0, 6, 20, 40, file.length - 1]) {
      const bad = Buffer.from(file);
      bad[i] = bad[i]! ^ 0xff;
      assert.throws(() => decryptBackup(bad, key), BackupFormatError, `byte ${i}`);
    }
  });
  test('truncated file is detected', () => {
    const file = encryptBackup(payload, key);
    assert.throws(() => decryptBackup(file.subarray(0, file.length - 10), key), BackupFormatError);
    assert.throws(() => decryptBackup(file.subarray(0, 10), key), BackupFormatError);
  });
  test('non-backup file is rejected', () => {
    assert.throws(() => decryptBackup(Buffer.from('hello world, definitely not a backup file at all'), key), BackupFormatError);
  });
  test('key must be 32 bytes as hex or base64', () => {
    const b64 = crypto.randomBytes(32).toString('base64');
    for (const bad of ['', 'abc', 'z'.repeat(64), KEY_HEX.slice(2), b64.slice(1), b64.slice(0, 42) + '$=', 'a'.repeat(43) + '$']) {
      assert.throws(() => parseBackupKey(bad), BackupFormatError, bad);
    }
    assert.equal(parseBackupKey(KEY_HEX).length, 32);
  });
  test('base64 key (openssl rand -base64 32) works and equals its hex form', () => {
    const raw = crypto.randomBytes(32);
    const asB64 = raw.toString('base64');
    assert.match(asB64, /^[A-Za-z0-9+/]{43}=$/);
    assert.deepEqual(parseBackupKey(asB64), raw);
    assert.deepEqual(parseBackupKey(raw.toString('hex')), raw);
    // A file encrypted with the hex form opens with the base64 form of the same key.
    assert.deepEqual(decryptBackup(encryptBackup(payload, parseBackupKey(raw.toString('hex'))), parseBackupKey(asB64)), payload);
  });
  test('surrounding whitespace/newline from a pasted key is tolerated', () => {
    assert.equal(parseBackupKey(`  ${KEY_HEX}\n`).length, 32);
  });
  test('compresses repetitive data well', () => {
    const big: BackupPayload = { ...payload, data: { Order: Array.from({ length: 5000 }, (_, i) => ({ id: `o${i}`, status: 'PAID', total: 499 })) } };
    const raw = Buffer.byteLength(JSON.stringify(big));
    assert.ok(encryptBackup(big, key).length < raw / 5);
  });
});

describe('backupObjectKey', () => {
  test('sortable, dated, .dmbk', () => {
    assert.equal(backupObjectKey(new Date('2026-10-27T18:30:05.123Z')), 'db/2026/10/dosh-20261027T183005Z.dmbk');
  });
  test('later time sorts after earlier', () => {
    assert.ok(backupObjectKey(new Date('2026-10-28T00:00:00Z')) > backupObjectKey(new Date('2026-10-27T23:59:59Z')));
  });
});

describe('selectBackupsToDelete', () => {
  const now = new Date('2026-10-27T00:00:00Z');
  const day = (n: number): StoredBackup => ({ key: `k${n}`, size: 1, lastModified: new Date(now.getTime() - n * 86_400_000) });
  test('deletes only older than retention', () => {
    const all = Array.from({ length: 40 }, (_, i) => day(i));
    const del = selectBackupsToDelete(all, now, 30, 7).map((b) => b.key);
    assert.equal(del.length, 9); // days 31..39 (day 30 is exactly the cutoff, kept)
    assert.ok(del.every((k) => Number(k.slice(1)) > 30));
  });
  test('always keeps the newest minKeep even if all are expired (job broke for months)', () => {
    const all = Array.from({ length: 10 }, (_, i) => day(100 + i));
    const del = selectBackupsToDelete(all, now, 30, 7);
    assert.equal(del.length, 3);
    const kept = all.filter((b) => !del.includes(b)).map((b) => b.key);
    assert.deepEqual(kept.sort(), ['k100', 'k101', 'k102', 'k103', 'k104', 'k105', 'k106']);
  });
  test('nothing to delete when few backups', () => {
    assert.deepEqual(selectBackupsToDelete([day(500), day(600)], now, 30, 7), []);
  });
  test('order of input does not matter', () => {
    const all = Array.from({ length: 12 }, (_, i) => day(40 + i)).reverse();
    assert.equal(selectBackupsToDelete(all, now, 30, 7).length, 5);
  });
});

describe('sortTablesByDependency', () => {
  test('parents before children', () => {
    const { order, cyclic } = sortTablesByDependency(
      ['OrderItem', 'Order', 'User', 'Payment', 'ProductVariant', 'Product'],
      [
        { child: 'OrderItem', parent: 'Order' }, { child: 'OrderItem', parent: 'ProductVariant' },
        { child: 'Order', parent: 'User' }, { child: 'Payment', parent: 'Order' }, { child: 'ProductVariant', parent: 'Product' },
      ],
    );
    assert.equal(cyclic, false);
    const idx = (t: string) => order.indexOf(t);
    assert.ok(idx('User') < idx('Order') && idx('Order') < idx('OrderItem') && idx('Order') < idx('Payment'));
    assert.ok(idx('Product') < idx('ProductVariant') && idx('ProductVariant') < idx('OrderItem'));
    assert.equal(order.length, 6);
  });
  test('self reference is not a cycle', () => {
    const r = sortTablesByDependency(['Category'], [{ child: 'Category', parent: 'Category' }]);
    assert.deepEqual(r, { order: ['Category'], cyclic: false });
  });
  test('real cycle is reported and still returns every table', () => {
    const r = sortTablesByDependency(['A', 'B', 'C'], [{ child: 'A', parent: 'B' }, { child: 'B', parent: 'A' }]);
    assert.equal(r.cyclic, true);
    assert.deepEqual([...r.order].sort(), ['A', 'B', 'C']);
  });
  test('edges to unknown tables are ignored', () => {
    assert.deepEqual(sortTablesByDependency(['A'], [{ child: 'A', parent: 'Z' }]).order, ['A']);
  });
});

describe('assertSafeIdentifier / chunk', () => {
  test('accepts normal table names', () => {
    for (const ok of ['Order', 'OrderItem', '_prisma', 'table_1']) assert.equal(assertSafeIdentifier(ok), ok);
  });
  test('rejects injection attempts', () => {
    for (const bad of ['Order"; DROP TABLE "User', 'a b', '1abc', '', 'a.b', 'x--', "o'r"]) assert.throws(() => assertSafeIdentifier(bad));
  });
  test('chunk splits evenly and keeps remainder', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunk([], 3), []);
  });
});
