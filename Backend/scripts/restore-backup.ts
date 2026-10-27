// Restore tool for the nightly encrypted backups (src/jobs/db-backup.ts). See docs/RECOVERY.md.
//
//   npx tsx --env-file=.env scripts/restore-backup.ts list
//   npx tsx --env-file=.env scripts/restore-backup.ts inspect <r2-key | local-file>
//   npx tsx --env-file=.env scripts/restore-backup.ts restore <r2-key | local-file> --side-schema restore_20261027 [--apply]
//   npx tsx --env-file=.env scripts/restore-backup.ts restore <r2-key | local-file> --target-url <postgres-url> [--apply]
//   npx tsx --env-file=.env scripts/restore-backup.ts drop-schema restore_20261027 --apply
//
// Nothing is written without --apply (otherwise it prints what it WOULD do). It never touches the
// live public schema: `--side-schema` creates a separate schema next to it for surgical recovery
// (copy back just the rows you need), and `--target-url` fills an EMPTY, already-migrated database
// (a fresh Neon branch/project) and refuses to write into one that has any data.
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';
import { decryptBackup, parseBackupKey, type BackupPayload } from '../src/shared/backup/format';
import { assertSafeIdentifier, chunk, sortTablesByDependency, type FkEdge } from '../src/shared/backup/plan';
import { getBackup, listBackups } from '../src/shared/backup/storage';

const [, , command, ...rest] = process.argv;
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : (rest[i + 1] ?? '');
};
const apply = rest.includes('--apply');
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1]?.startsWith('--') && rest[i - 1] !== '--apply'))[0];

async function load(source: string): Promise<BackupPayload> {
  const key = parseBackupKey(env.BACKUP_ENCRYPTION_KEY);
  const file = fs.existsSync(source) ? fs.readFileSync(source) : await getBackup(source);
  return decryptBackup(file, key);
}

function summarize(p: BackupPayload) {
  const total = Object.values(p.manifest.tables).reduce((a, b) => a + b, 0);
  console.log(`Backup taken : ${p.manifest.createdAt}`);
  console.log(`Postgres     : ${p.manifest.serverVersion}`);
  console.log(`Migrations   : ${p.manifest.migrations.length} (last: ${p.manifest.migrations.at(-1) ?? 'none'})`);
  console.log(`Total rows   : ${total}`);
  for (const [t, n] of Object.entries(p.manifest.tables)) console.log(`  ${t.padEnd(28)} ${n}`);
}

async function insertRows(db: PrismaClient, schema: string, table: string, rows: unknown[]) {
  const qualified = `"${assertSafeIdentifier(schema)}"."${assertSafeIdentifier(table)}"`;
  for (const part of chunk(rows, 500)) {
    await db.$executeRawUnsafe(`INSERT INTO ${qualified} SELECT * FROM jsonb_populate_recordset(NULL::${qualified}, $1::jsonb)`, JSON.stringify(part));
  }
}

function hostDb(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace(/-pooler/, '')}${u.pathname}`;
}

async function restoreSideSchema(p: BackupPayload, schema: string) {
  if (!/^restore_[a-z0-9_]+$/.test(schema)) throw new Error('Side schema name must match restore_[a-z0-9_]+');
  console.log(`\nPlan: create schema "${schema}" in the CURRENT database (public is not touched) and load ${Object.keys(p.data).length} tables.`);
  if (!apply) return console.log('Dry run - add --apply to execute.');
  const db = new PrismaClient({ datasourceUrl: env.DIRECT_URL ?? env.DATABASE_URL });
  try {
    const exists = await db.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, schema);
    if (exists.length > 0) throw new Error(`Schema ${schema} already exists - pick another name or drop-schema it first`);
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        for (const [table, rows] of Object.entries(p.data)) {
          assertSafeIdentifier(table);
          await tx.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (LIKE "public"."${table}" INCLUDING DEFAULTS)`);
          await insertRows(tx as unknown as PrismaClient, schema, table, rows);
        }
      },
      { timeout: 300_000, maxWait: 15_000 }
    );
    console.log(`\nDone. Inspect with e.g.  SELECT * FROM "${schema}"."Order" WHERE ...;  then copy rows back and run:\n  drop-schema ${schema} --apply`);
  } finally {
    await db.$disconnect();
  }
}

async function restoreToTarget(p: BackupPayload, targetUrl: string) {
  for (const prod of [env.DATABASE_URL, env.DIRECT_URL]) {
    if (prod && hostDb(prod) === hostDb(targetUrl)) {
      throw new Error('Target is the production database. Restore into a NEW empty database (e.g. a fresh Neon branch), then repoint DATABASE_URL.');
    }
  }
  console.log(`\nPlan: load ${Object.keys(p.data).length} tables into ${hostDb(targetUrl)} (must be empty and migrated).`);
  const db = new PrismaClient({ datasourceUrl: targetUrl });
  try {
    const applied = new Set(
      (await db.$queryRawUnsafe<Array<{ migration_name: string }>>(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)).map((r) => r.migration_name)
    );
    const missing = p.manifest.migrations.filter((m) => !applied.has(m));
    if (missing.length) throw new Error(`Target is missing ${missing.length} migration(s) (first: ${missing[0]}). Run \`prisma migrate deploy\` against it first.`);
    const extra = [...applied].filter((m) => !p.manifest.migrations.includes(m));
    if (extra.length) console.warn(`WARNING: target has ${extra.length} newer migration(s) than the backup; rows load with NULL for any new columns.`);

    const tables = Object.keys(p.data);
    for (const t of tables) {
      const n = (await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*) AS n FROM "public"."${assertSafeIdentifier(t)}"`))[0]?.n ?? 0n;
      if (Number(n) > 0) throw new Error(`Target table ${t} already has ${n} rows - refusing to merge into a non-empty database.`);
    }
    const fks = (
      await db.$queryRawUnsafe<Array<{ child: string; parent: string }>>(
        `SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`
      )
    ).map((r): FkEdge => ({ child: r.child.replace(/"/g, ''), parent: r.parent.replace(/"/g, '') }));
    const { order, cyclic } = sortTablesByDependency(tables, fks);
    console.log(`Insert order: ${order.join(' -> ')}${cyclic ? '  (FK cycle detected - will relax FK checks)' : ''}`);
    if (!apply) return console.log('Dry run - add --apply to execute.');

    await db.$transaction(
      async (tx) => {
        if (cyclic) await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
        for (const t of order) await insertRows(tx as unknown as PrismaClient, 'public', t, p.data[t] ?? []);
      },
      { timeout: 600_000, maxWait: 15_000 }
    );

    let bad = 0;
    for (const t of tables) {
      const n = (await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*) AS n FROM "public"."${t}"`))[0]?.n ?? 0n;
      const ok = Number(n) === p.manifest.tables[t];
      if (!ok) bad++;
      console.log(`  ${ok ? 'OK ' : 'BAD'} ${t.padEnd(28)} expected ${p.manifest.tables[t]} got ${n}`);
    }
    if (bad) throw new Error(`${bad} table(s) do not match the backup`);
    console.log('\nRestore verified: every table row count matches the backup.');
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  if (command === 'list') {
    for (const b of (await listBackups()).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())) {
      console.log(`${b.lastModified.toISOString()}  ${(b.size / 1024).toFixed(0).padStart(8)} KB  ${b.key}`);
    }
    return;
  }
  if (command === 'inspect') {
    if (!positional) throw new Error('Usage: inspect <r2-key | local-file>');
    return summarize(await load(positional));
  }
  if (command === 'restore') {
    if (!positional) throw new Error('Usage: restore <r2-key | local-file> --side-schema <name> | --target-url <url> [--apply]');
    const payload = await load(positional);
    summarize(payload);
    const side = flag('side-schema');
    const target = flag('target-url');
    if (side && target) throw new Error('Choose one of --side-schema / --target-url');
    if (side) return restoreSideSchema(payload, side);
    if (target) return restoreToTarget(payload, target);
    throw new Error('Specify --side-schema <name> or --target-url <url>');
  }
  if (command === 'drop-schema') {
    const name = positional;
    if (!name || !/^restore_[a-z0-9_]+$/.test(name)) throw new Error('Only schemas named restore_* can be dropped');
    if (!apply) return console.log(`Dry run - would DROP SCHEMA "${name}" CASCADE. Add --apply.`);
    const db = new PrismaClient({ datasourceUrl: env.DIRECT_URL ?? env.DATABASE_URL });
    try {
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
      console.log(`Dropped ${name}`);
    } finally {
      await db.$disconnect();
    }
    return;
  }
  console.log('Commands: list | inspect <key|file> | restore <key|file> (--side-schema N | --target-url U) [--apply] | drop-schema <restore_N> --apply');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
