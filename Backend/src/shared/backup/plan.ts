// Pure helpers for the backup job and the restore tool - no I/O, so they are unit-tested.

const TABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Identifiers are interpolated into SQL (they cannot be bound parameters), so they are validated. */
export function assertSafeIdentifier(name: string): string {
  if (!TABLE_NAME_RE.test(name)) throw new Error(`Unsafe SQL identifier: ${JSON.stringify(name)}`);
  return name;
}

export function backupObjectKey(now: Date): string {
  const iso = now.toISOString(); // 2026-10-27T18:30:05.123Z
  const stamp = iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); // 20261027T183005Z
  return `db/${iso.slice(0, 4)}/${iso.slice(5, 7)}/dosh-${stamp}.dmbk`;
}

export interface StoredBackup {
  key: string;
  lastModified: Date;
  size: number;
}

/**
 * Which backups to delete. Anything older than `retentionDays` goes, EXCEPT the newest `minKeep`
 * are always retained - so a broken job that stops uploading can never age the last good backups out.
 */
export function selectBackupsToDelete(all: StoredBackup[], now: Date, retentionDays: number, minKeep = 7): StoredBackup[] {
  const newestFirst = [...all].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  return newestFirst.slice(minKeep).filter((b) => b.lastModified.getTime() < cutoff);
}

export interface FkEdge {
  child: string;
  parent: string;
}

/**
 * Parents-first insert order. Self references are ignored (a row can point at itself). If a real
 * cycle exists the remaining tables are appended and `cyclic` is true - the restore then needs
 * FK checks relaxed.
 */
export function sortTablesByDependency(tables: string[], edges: FkEdge[]): { order: string[]; cyclic: boolean } {
  const set = new Set(tables);
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set<string>()]));
  for (const { child, parent } of edges) {
    if (child !== parent && set.has(child) && set.has(parent)) deps.get(child)!.add(parent);
  }
  const order: string[] = [];
  const done = new Set<string>();
  let progressed = true;
  while (order.length < tables.length && progressed) {
    progressed = false;
    for (const t of [...tables].sort()) {
      if (done.has(t)) continue;
      if ([...deps.get(t)!].every((p) => done.has(p))) {
        order.push(t);
        done.add(t);
        progressed = true;
      }
    }
  }
  const cyclic = order.length < tables.length;
  if (cyclic) for (const t of [...tables].sort()) if (!done.has(t)) order.push(t);
  return { order, cyclic };
}

/** Chunks rows so one INSERT statement never carries an unbounded JSON parameter. */
export function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
