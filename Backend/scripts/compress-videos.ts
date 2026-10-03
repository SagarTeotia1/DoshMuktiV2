// One-off: how-to-use videos on product pages are raw phone/camera exports (25–50 MB), which
// stalls playback on mobile data. Downloads each directly-hosted video, re-encodes it to
// 720p H.264 + AAC with the moov atom up front (faststart, so it can start playing before
// the download finishes), and prints the size before/after.
//
// Safe by design — this is run against a live bucket:
//   • Default run is read-only: GET the originals, write compressed copies to a local temp dir.
//   • --upload PUTs each compressed file under a NEW content-hashed key with an immutable
//     Cache-Control. It never overwrites or deletes the original object.
//   • It never touches the database. It prints "old URL -> new URL"; swap the URL in Admin
//     (product edit -> How-to video URL) once you've played the new file and are happy with it.
//
// Usage (from Backend/):
//   FFMPEG_PATH=/path/to/ffmpeg npx tsx --env-file=.env scripts/compress-videos.ts
//   FFMPEG_PATH=... npx tsx --env-file=.env scripts/compress-videos.ts --upload
//   ...optionally pass explicit video URLs as extra args to skip the DB lookup.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../src/shared/db/client';
import { r2 } from '../src/shared/integrations/r2/client';
import { env } from '../src/config/env';

const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const OUT_DIR = join(tmpdir(), 'dosh-video-compress');
const SKIP_BELOW_BYTES = 8 * 1024 * 1024; // already small enough — leave it alone
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

const args = process.argv.slice(2);
const upload = args.includes('--upload');
const explicitUrls = args.filter((a) => a.startsWith('http'));

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function isDirectVideo(url: string): boolean {
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(url)) return false;
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

async function listVideoUrls(): Promise<string[]> {
  if (explicitUrls.length > 0) return explicitUrls;
  const rows = await db.product.findMany({
    where: { howToUseVideoUrl: { not: null } },
    select: { howToUseVideoUrl: true },
  });
  const urls = rows.map((r) => r.howToUseVideoUrl).filter((u): u is string => !!u && isDirectVideo(u));
  return [...new Set(urls)];
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const probe = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.error(`ffmpeg not runnable at "${FFMPEG}" — set FFMPEG_PATH. Nothing was changed.`);
    process.exit(1);
  }

  const urls = await listVideoUrls();
  console.log(`${urls.length} direct video URL(s). Mode: ${upload ? 'UPLOAD (new keys only)' : 'dry-run (local only)'}\n`);

  for (const url of urls) {
    const name = decodeURIComponent(basename(new URL(url).pathname)).replace(/[^\w.-]+/g, '_');
    const inPath = join(OUT_DIR, `in-${name}`);
    const outPath = join(OUT_DIR, `out-${name.replace(/\.\w+$/, '')}.mp4`);

    console.log(`• ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  skip: download failed (${res.status})\n`);
      continue;
    }
    writeFileSync(inPath, Buffer.from(await res.arrayBuffer()));
    const before = statSync(inPath).size;

    if (before < SKIP_BELOW_BYTES) {
      console.log(`  skip: already ${mb(before)}\n`);
      continue;
    }

    // scale=-2:'min(1280,ih)' caps the long edge at 1280 (720x1280 for the 9:16 clips) and
    // never upscales; -2 keeps the width even, which libx264 requires.
    const ff = spawnSync(
      FFMPEG,
      [
        '-y', '-i', inPath,
        '-vf', "scale=-2:'min(1280,ih)'",
        '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart',
        outPath,
      ],
      { encoding: 'utf8' }
    );
    if (ff.status !== 0) {
      console.log(`  skip: ffmpeg failed\n${(ff.stderr ?? '').split('\n').slice(-6).join('\n')}\n`);
      continue;
    }
    const after = statSync(outPath).size;
    console.log(`  ${mb(before)} -> ${mb(after)}  (${Math.round((1 - after / before) * 100)}% smaller)  local: ${outPath}`);

    if (!upload) {
      console.log('  (dry-run — not uploaded)\n');
      continue;
    }

    const body = readFileSync(outPath);
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
    const key = `videos/${hash}-${name.replace(/\.\w+$/, '')}.mp4`;
    try {
      await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
      console.log(`  key already exists, not overwriting: ${key}\n`);
      continue;
    } catch {
      // 404 = free to create
    }
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: 'video/mp4',
        CacheControl: IMMUTABLE_CACHE,
      })
    );
    const newUrl = `${new URL(url).origin}/${key}`;
    console.log(`  uploaded. Set this in Admin once verified:\n    ${url}\n    -> ${newUrl}\n`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
