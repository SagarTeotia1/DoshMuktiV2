'use client';

import { toast } from 'sonner';
import { Database, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { useBackups, useRunBackup } from '@/hooks/use-backups';
import { formatDate } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';

// A nightly backup missing for this long means the scheduler (or the job) is broken.
const STALE_AFTER_HOURS = 36;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 60 / 24)} days ago`;
}

export default function BackupsPage() {
  const { data, isLoading, isError, error } = useBackups();
  const run = useRunBackup();

  const latest = data?.backups[0];
  const stale = data?.configured && (!latest || Date.now() - new Date(latest.takenAt).getTime() > STALE_AFTER_HOURS * 3_600_000);

  function backupNow() {
    run.mutate(undefined, {
      onSuccess: (r) => toast.success(`Backup saved · ${r.rows.toLocaleString('en-IN')} rows · ${formatSize(r.bytes)}`),
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Backup failed'),
    });
  }

  return (
    <>
      <Topbar title="Backups" />
      <div className="p-6 flex flex-col gap-6 max-w-4xl">
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
            Could not load backups: {error instanceof ApiError ? error.body.error : 'unknown error'}
          </div>
        )}

        {data && !data.configured && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            <p className="font-semibold flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" /> Backups are not set up on the server yet
            </p>
            <p className="mt-1">
              Missing: <code className="font-mono">{data.missing.join(', ')}</code>. Add them to the server environment and restart (steps in{' '}
              <code className="font-mono">docs/RECOVERY.md</code>). Until then no backup can be made.
            </p>
          </div>
        )}

        {data?.configured && stale && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
            <p className="font-semibold flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" /> {latest ? `Last backup was ${ago(latest.takenAt)}` : 'No backup exists yet'}
            </p>
            <p className="mt-1">
              The nightly job should leave one every day. Press “Back up now”, then check the scheduler is calling the backup job.
            </p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-[#9C5A26] mt-0.5" />
            <div>
              <h2 className="font-heading font-bold text-sm text-slate-900">Database backup</h2>
              <p className="text-xs text-slate-500 mt-1">
                {latest ? `Latest: ${formatDate(latest.takenAt)} (${ago(latest.takenAt)}) · ${formatSize(latest.sizeBytes)}` : 'No backups yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Encrypted, stored in a private bucket · kept {data?.retentionDays ?? 30} days (newest 7
                always kept)
              </p>
            </div>
          </div>
          <button
            onClick={backupNow}
            disabled={run.isPending || !data?.configured}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {run.isPending ? 'Backing up…' : 'Back up now'}
          </button>
        </div>

        {data?.configured && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-heading font-bold text-sm text-slate-900">Saved backups</h2>
              <span className="text-xs text-slate-400">{data.backups.length} file(s)</span>
            </div>
            {data.backups.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">Nothing saved yet. Press “Back up now” to make the first one.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2 font-semibold">When</th>
                    <th className="px-5 py-2 font-semibold">Size</th>
                    <th className="px-5 py-2 font-semibold">File</th>
                  </tr>
                </thead>
                <tbody>
                  {data.backups.map((b) => (
                    <tr key={b.key} className="border-t border-slate-100">
                      <td className="px-5 py-2 text-slate-700">
                        {formatDate(b.takenAt)} <span className="text-slate-400">· {ago(b.takenAt)}</span>
                      </td>
                      <td className="px-5 py-2 text-slate-600">{formatSize(b.sizeBytes)}</td>
                      <td className="px-5 py-2 font-mono text-xs text-slate-400">{b.key}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400">
          To restore, use <code className="font-mono">scripts/restore-backup.ts</code> as described in{' '}
          <code className="font-mono">docs/RECOVERY.md</code>. Backups are never downloadable from this panel, on purpose: they contain customer
          data.
        </p>
      </div>
    </>
  );
}
