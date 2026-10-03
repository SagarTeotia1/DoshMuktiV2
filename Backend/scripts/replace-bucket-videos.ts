// One-off: replace the oversized (50–125 MB) raw video exports in the R2 bucket with 720p
// H.264/AAC faststart copies, in place — same key, so every stored URL keeps working and
// no DB rows change.
//
// Safety, because this writes to the live bucket:
//   • Default run is a read-only dry run (just lists what would be touched).
//   • --apply, per object, in this order: download -> compress -> validate -> copy original to
//     backup/<key> and verify its size -> overwrite <key> -> verify size + that the public URL
//     serves it. If any step after the overwrite fails, the original is restored from backup.
//   • Validation refuses to replace unless the output is >=10% smaller, keeps its video stream,
//     and its duration is within 1.5% of the source.
//   • Resumable: an object whose backup exists and whose live copy is already smaller is skipped.
//   • --rollback restores every backup/<key> over <key>. Backups are never deleted by this script.
//
// Usage (from Backend/):
//   FFMPEG_PATH=... npx tsx --env-file=.env scripts/replace-bucket-videos.ts            # dry run
//   FFMPEG_PATH=... npx tsx --env-file=.env scripts/replace-bucket-videos.ts --apply
//   ... --apply --only=pyrite         # only keys containing "pyrite"
//   ... --rollback [--only=pyrite]    # restore from backup/
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { r2 } from '../src/shared/integrations/r2/client';
import { env } from '../src/config/env';

const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const WORK_DIR = join(tmpdir(), 'dosh-bucket-videos');
const BACKUP_PREFIX = 'backup/';
const SKIP_PREFIXES = [BACKUP_PREFIX, 'videos/'];
const MIN_BYTES = 8 * 1024 * 1024;
const CACHE_CONTROL = 'public, max-age=2592000'; // 30 days — same key gets overwritten, so not "immutable"

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const rollback = args.includes('--rollback');
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).toLowerCase();

const Bucket = env.R2_BUCKET_NAME;
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
const copySource = (key: string) => `${Bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function listAll(): Promise<{ Key: string; Size: number }[]> {
  const out: { Key: string; Size: number }[] = [];
  let token: string | undefined;
  do {
    const r = await r2.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key) out.push({ Key: o.Key, Size: o.Size ?? 0 });
    token = r.NextContinuationToken;
  } while (token);
  return out;
}

async function headSize(key: string): Promise<number | null> {
  try {
    return (await r2.send(new HeadObjectCommand({ Bucket, Key: key }))).ContentLength ?? 0;
  } catch {
    return null;
  }
}

function durationSeconds(path: string): { seconds: number | null; hasVideo: boolean } {
  // ffmpeg -i with no output exits non-zero but prints the stream info we need on stderr.
  const r = spawnSync(FFMPEG, ['-i', path], { encoding: 'utf8' });
  const text = r.stderr ?? '';
  const m = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return {
    seconds: m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null,
    hasVideo: /Stream #\d+:\d+.*Video:/.test(text),
  };
}

async function publicServes(key: string, expectedSize: number): Promise<boolean> {
  try {
    const url = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    if (res.status !== 206 && res.status !== 200) return false;
    const total = res.headers.get('content-range')?.match(/\/(\d+)$/)?.[1] ?? res.headers.get('content-length');
    // A 200 to a Range request returns the full length; a 206 reports it after the slash.
    return Number(total) === expectedSize;
  } catch {
    return false;
  }
}

async function restore(key: string): Promise<boolean> {
  try {
    await r2.send(new CopyObjectCommand({ Bucket, Key: key, CopySource: copySource(BACKUP_PREFIX + key), MetadataDirective: 'COPY' }));
    return true;
  } catch (e) {
    console.error(`  !! RESTORE FAILED for ${key}:`, e);
    return false;
  }
}

async function processOne(key: string, size: number): Promise<'replaced' | 'skipped' | 'failed'> {
  const safe = key.replace(/[^\w.-]+/g, '_');
  const inPath = join(WORK_DIR, `in-${safe}`);
  const outPath = join(WORK_DIR, `out-${safe}`);
  try {
    // Resume: already replaced in an earlier run.
    const existingBackup = await headSize(BACKUP_PREFIX + key);
    if (existingBackup !== null && size < existingBackup * 0.9) {
      console.log(`  skip: already replaced (live ${mb(size)}, backup ${mb(existingBackup)})`);
      return 'skipped';
    }

    const got = await r2.send(new GetObjectCommand({ Bucket, Key: key }));
    writeFileSync(inPath, Buffer.from(await got.Body!.transformToByteArray()));
    const before = statSync(inPath).size;
    if (before !== size) throw new Error(`downloaded ${before} bytes, expected ${size}`);

    const ff = spawnSync(
      FFMPEG,
      [
        '-y', '-i', inPath,
        '-vf', "scale=-2:'min(1280,ih)'",
        '-c:v', 'libx264', '-crf', '28', '-preset', 'medium', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart',
        outPath,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    if (ff.status !== 0) throw new Error(`ffmpeg failed: ${(ff.stderr ?? '').split('\n').slice(-4).join(' | ')}`);

    const after = statSync(outPath).size;
    const src = durationSeconds(inPath);
    const dst = durationSeconds(outPath);
    if (!dst.hasVideo) throw new Error('output has no video stream');
    if (after > before * 0.9) {
      console.log(`  skip: not worth it (${mb(before)} -> ${mb(after)})`);
      return 'skipped';
    }
    if (src.seconds === null || dst.seconds === null || Math.abs(dst.seconds - src.seconds) > src.seconds * 0.015) {
      throw new Error(`duration mismatch (src ${src.seconds}s, out ${dst.seconds}s)`);
    }

    // 1) Backup the original and prove it's intact before touching the live key.
    if (existingBackup === null) {
      await r2.send(new CopyObjectCommand({ Bucket, Key: BACKUP_PREFIX + key, CopySource: copySource(key), MetadataDirective: 'COPY' }));
    }
    const backupSize = await headSize(BACKUP_PREFIX + key);
    if (backupSize !== before) throw new Error(`backup size ${backupSize} != original ${before} — aborting before overwrite`);

    // 2) Overwrite, then verify. Anything wrong from here on restores the original.
    await r2.send(
      new PutObjectCommand({ Bucket, Key: key, Body: readFileSync(outPath), ContentType: 'video/mp4', CacheControl: CACHE_CONTROL })
    );
    const liveSize = await headSize(key);
    const serves = await publicServes(key, after);
    if (liveSize !== after || !serves) {
      console.error(`  !! verify failed (live ${liveSize}, expected ${after}, public serves: ${serves}) — restoring original`);
      const ok = await restore(key);
      console.error(ok ? '  restored original.' : '  RESTORE FAILED — original is safe at ' + BACKUP_PREFIX + key);
      return 'failed';
    }

    console.log(`  replaced: ${mb(before)} -> ${mb(after)} (${Math.round((1 - after / before) * 100)}% smaller), backup: ${BACKUP_PREFIX}${key}`);
    return 'replaced';
  } catch (e) {
    console.error(`  failed (live file untouched unless noted above): ${e instanceof Error ? e.message : e}`);
    return 'failed';
  } finally {
    rmSync(inPath, { force: true });
    rmSync(outPath, { force: true });
  }
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });
  const all = await listAll();

  if (rollback) {
    const backups = all.filter((o) => o.Key.startsWith(BACKUP_PREFIX) && (!only || o.Key.toLowerCase().includes(only)));
    console.log(`Rollback: ${backups.length} backup object(s).${apply ? '' : ' (dry run — pass --apply to restore)'}`);
    for (const b of backups) {
      const key = b.Key.slice(BACKUP_PREFIX.length);
      console.log(`• ${key}`);
      if (apply) await r2.send(new CopyObjectCommand({ Bucket, Key: key, CopySource: copySource(b.Key), MetadataDirective: 'COPY' }));
    }
    return;
  }

  const probe = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.error(`ffmpeg not runnable at "${FFMPEG}" — set FFMPEG_PATH. Nothing was changed.`);
    process.exit(1);
  }

  const targets = all
    .filter((o) => /\.mp4$/i.test(o.Key) && o.Size > MIN_BYTES && !SKIP_PREFIXES.some((p) => o.Key.startsWith(p)))
    .filter((o) => !only || o.Key.toLowerCase().includes(only))
    .sort((a, b) => a.Size - b.Size);

  const totalBytes = targets.reduce((s, o) => s + o.Size, 0);
  console.log(`${targets.length} video(s) to process, ${mb(totalBytes)} total. Mode: ${apply ? 'APPLY' : 'dry run'}\n`);

  const tally = { replaced: 0, skipped: 0, failed: 0 };
  let i = 0;
  for (const t of targets) {
    console.log(`[${++i}/${targets.length}] ${t.Key} (${mb(t.Size)})`);
    if (!apply) continue;
    tally[await processOne(t.Key, t.Size)]++;
  }
  if (apply) console.log(`\nDone. replaced=${tally.replaced} skipped=${tally.skipped} failed=${tally.failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
