# Database backup & recovery

Data lives in Neon Postgres. This file is the runbook. Read **"I need to recover right now"** first.

## What protects the data

| Layer | Covers | Window |
|---|---|---|
| **Neon point-in-time restore** (provider feature) | Any mistake, to the second | Only as far back as your Neon plan's history retention — **check it in the Neon console and set it to 7+ days** |
| **Nightly encrypted backup** (`/jobs/db-backup`) | Provider/account loss, anything older than Neon's window | One file per night, 30 days (`BACKUP_RETENTION_DAYS`), the newest 7 are never pruned |
| Git | Code + migrations | Forever. Not data. |
| Razorpay / Delhivery / Ekart | Independent record of payments and shipments | Their retention |

Nightly means worst-case loss (RPO) of up to ~24h *if Neon's own history is also unavailable*. With Neon history it is seconds.

**Not backed up by this job:** Cloudflare R2 product images (turn on R2 object versioning or keep a copy elsewhere), Redis/Upstash (cache and carts only — safe to lose), and **secrets** (see "Secrets" below).

## How the nightly backup works

`POST /jobs/db-backup` (CRON_SECRET-gated, hit by Cloud Scheduler like the other `/jobs/*`):

1. Reads every `public` table in **one repeatable-read transaction** — a consistent snapshot, so an order is never saved without its items even while customers are checking out.
2. Gzip → **AES-256-GCM** encrypt (authenticated: a corrupted or tampered file refuses to open).
3. Uploads to a **private** R2 bucket (`BACKUP_R2_BUCKET`), verifies the stored size, and test-decrypts the exact bytes it sent.
4. Only then prunes old backups. An empty snapshot is rejected, and the newest 7 files are never deleted, so a broken job can't age out your last good backups.
5. On any failure it **emails `ADMIN_EMAIL`** and returns 500 so the scheduler shows the run as failed.

Backups contain customer phones, addresses and orders. That is why the bucket must be private, separate from the public images bucket, and the file is encrypted anyway. The Backend refuses to run if `BACKUP_R2_BUCKET` equals `R2_BUCKET_NAME`.

## One-time setup (not done yet — the job fails loudly until it is)

1. **Create a private R2 bucket**, e.g. `doshmukti-db-backups`. Do **not** enable public access or attach a custom domain. Enable object versioning/lifecycle if you like; the job prunes by itself.
2. **Generate the encryption key** and store it in a password manager *and* the server env:
   `openssl rand -hex 32` → `BACKUP_ENCRYPTION_KEY`
   **If this key is lost, every backup is permanently unreadable.** Keep a copy that does not live only on the server.
3. **Env (Backend):** `BACKUP_R2_BUCKET=doshmukti-db-backups`, `BACKUP_ENCRYPTION_KEY=<64 hex>`, optional `BACKUP_RETENTION_DAYS=30`. The existing `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` are reused — make sure that API token can read/write the new bucket (or create a token scoped to it).
4. **Schedule it** (example, 02:30 IST daily; use the same service account/URL pattern as your other jobs):
   ```
   gcloud scheduler jobs create http db-backup \
     --schedule="30 2 * * *" --time-zone="Asia/Kolkata" \
     --uri="https://api.doshmukti.com/jobs/db-backup" --http-method=POST \
     --headers="Authorization=Bearer <CRON_SECRET>" --attempt-deadline=300s
   ```
5. **Run it once by hand** and confirm a file appears:
   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://api.doshmukti.com/jobs/db-backup`
   then `npx tsx --env-file=.env scripts/restore-backup.ts list`.
6. Do a restore drill (below) before you ever need it.

## I need to recover right now

Pick the situation. In every case: **stop the damage first** (pause the job/admin action that is deleting data), and do **not** run anything against production until you know which option you need.

### A. Some rows were deleted/changed by mistake (most common)
1. **Neon first**: in the Neon console create a **branch from a point in time** just before the mistake (Neon calls this restore/branching; it doesn't touch production). Read the correct rows from that branch.
2. If it's older than Neon's window, use the nightly backup into a **side schema** — nothing in `public` is touched:
   ```
   npx tsx --env-file=.env scripts/restore-backup.ts list
   npx tsx --env-file=.env scripts/restore-backup.ts restore db/2026/10/dosh-20261027T210000Z.dmbk --side-schema restore_20261027 --apply
   ```
   Query `"restore_20261027"."Order"` etc., copy back only what you need with `INSERT … SELECT`, then clean up:
   `… drop-schema restore_20261027 --apply`
3. Re-check stock after restoring orders (`StockMovement` is append-only; reconcile `ProductVariant.stockQuantity` against it).

### B. The database is damaged/empty, or Neon is gone
1. Create a **new empty Postgres** (new Neon project/branch, or any Postgres 16+ with the `vector` extension: `CREATE EXTENSION vector;`).
2. Point a shell at it and apply the schema: `DATABASE_URL=<new> DIRECT_URL=<new> npx prisma migrate deploy` (from `Backend/`, on the commit that was deployed).
3. Dry-run, then restore (the tool refuses production and any non-empty target):
   ```
   npx tsx --env-file=.env scripts/restore-backup.ts restore <key> --target-url "<new direct url>"
   npx tsx --env-file=.env scripts/restore-backup.ts restore <key> --target-url "<new direct url>" --apply
   ```
   It loads inside one transaction (all-or-nothing) and verifies **every table's row count** against the backup.
4. Repoint `DATABASE_URL` / `DIRECT_URL` in the server env and restart. Smoke test: storefront loads, an old order opens in Admin, a test checkout works.
5. Anything created *after* the backup (orders in the last <24h) is missing. Rebuild it from Razorpay (payments), Delhivery/Ekart (shipments) and customer WhatsApp.

### C. A backup won't open
`Backup could not be decrypted` = wrong key or corrupted file. Try the previous night's file (`list`). The key must be the one that was set when that file was written — if you rotated it, use the old key via `BACKUP_ENCRYPTION_KEY` for that run.

## Restore drill (do this quarterly and after any schema-heavy release)

1. `list` → pick last night's file → `inspect <key>` (row counts should look right).
2. `restore <key> --side-schema restore_drill --apply`, spot-check a recent order, then `drop-schema restore_drill --apply`.
3. Once a year, do scenario B fully into a throwaway Neon branch and time it. At today's size (~9k rows, ~1.3 MB per backup) it takes seconds.
4. Confirm the failure email works: temporarily unset `BACKUP_ENCRYPTION_KEY` in a staging run and check `ADMIN_EMAIL` receives the alert.

Last verified: 2026-10-27 — snapshot of production (24 tables, 8,684 rows) restored into a scratch schema and compared **row-for-row** against live data, all identical; restore into production refused; wrong key refused.

## Secrets

Env values (`.env`, Cloud/VM env) are not in git and not in any backup. Keep an encrypted copy outside the server: Razorpay keys + webhook secret, `CRON_SECRET`, `JWT`/admin hash, Ekart (`EKART_*`, `EKART1_*`), Delhivery, R2, Resend, **`BACKUP_ENCRYPTION_KEY`**. Rebuilding a server without them is the slowest part of any recovery.

## Limits to know

- The job builds the dump in memory (JSON → gzip → encrypt). Fine into the hundreds of MB; if the database grows past roughly 1M orders, switch the job to `pg_dump` (needs the Postgres 18 client in the Docker image).
- Restore targets should be at the same schema version as the backup (`manifest.migrations`). The tool aborts if migrations are missing and warns if the target is newer.
- Pooled (pgbouncer) URLs work for the nightly job; use the **direct** URL for restores.
