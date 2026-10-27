import { db } from '../db/client';
import type { BackupPayload } from './format';
import { assertSafeIdentifier } from './plan';

// Reads every public table in ONE repeatable-read transaction, so the dump is a single
// consistent snapshot (an order never appears without its items, even while checkouts run).
// Rows are taken as Postgres' own to_jsonb(), which restores losslessly through
// jsonb_populate_recordset (enums, numerics, timestamps, arrays and pgvector all round-trip).
export async function collectSnapshot(): Promise<BackupPayload> {
  return db.$transaction(
    async (tx) => {
      const serverVersion = (await tx.$queryRawUnsafe<Array<{ server_version: string }>>('SHOW server_version'))[0]?.server_version ?? 'unknown';
      const tables = (
        await tx.$queryRawUnsafe<Array<{ table_name: string }>>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
           ORDER BY table_name`
        )
      ).map((r) => assertSafeIdentifier(r.table_name));
      const migrations = (
        await tx.$queryRawUnsafe<Array<{ migration_name: string }>>(
          `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`
        )
      ).map((r) => r.migration_name);

      const data: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const rows = await tx.$queryRawUnsafe<Array<{ r: unknown }>>(`SELECT to_jsonb(t) AS r FROM "public"."${table}" t`);
        data[table] = rows.map((x) => x.r);
        counts[table] = rows.length;
      }

      return {
        manifest: { version: 1 as const, createdAt: new Date().toISOString(), serverVersion, migrations, tables: counts },
        data,
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 120_000, maxWait: 15_000 }
  );
}
