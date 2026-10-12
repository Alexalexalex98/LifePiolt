import { realBackend, getEngine, snapshotAll } from './index';
import { databaseFiles } from './backend';
import { listAppFiles, deleteFiles, diskSpace } from './files';
import { buildReport, isLowSpace, referencedNames, type SpaceReport } from './space.ts';
import type { SqlKvBackend } from './sqlKv.ts';
import { pushNotice } from './status.ts';
import { useSecurity } from './securityStore';

const asSql = (b: unknown): SqlKvBackend | null => (b && (b as { kind?: string }).kind === 'sqlite' ? (b as SqlKvBackend) : null);

export type ArchiveStats = { kind: string; encryption: string; dbBytes: number; fileBytes: number; quarantine: number; pending: number; lastFlushMs: number; lastBytes: number };

/** Numeri dell'archivio per la schermata Sicurezza. */
export async function archiveStats(): Promise<ArchiveStats> {
  const e = getEngine();
  await e.ready().catch(() => undefined);
  const b = realBackend();
  const sql = asSql(b);
  const sizes = b ? await b.sizes().catch(() => []) : [];
  const dbBytes = sizes.reduce((a, s) => a + s.bytes, 0);
  const fileBytes = databaseFiles().reduce((a, f) => a + f.bytes, 0);
  return {
    kind: b?.kind ?? 'memory', encryption: b?.encryption ?? 'none', dbBytes, fileBytes,
    quarantine: sql ? (await sql.quarantineList().catch(() => [])).length : 0,
    pending: e.pendingCount(), lastFlushMs: e.stats.lastFlushMs, lastBytes: e.stats.lastBytes,
  };
}

export async function loadSpaceReport(): Promise<SpaceReport & { disk: { available: number; total: number } | null; low: boolean }> {
  const e = getEngine();
  await e.ready().catch(() => undefined);
  const b = realBackend();
  const sizes = b ? await b.sizes().catch(() => []) : [];
  const texts = Object.values(await snapshotAll().catch(() => ({} as Record<string, string>)));
  const files = listAppFiles();
  const report = buildReport({ stores: sizes.map((s) => ({ name: s.name.replace(/^lp2-/, ''), bytes: s.bytes })), files, referenced: referencedNames(texts) });
  const disk = diskSpace();
  return { ...report, disk, low: disk ? isLowSpace(disk.available, disk.total) : false };
}

export type CleanupPlan = { orphans: boolean; cache: boolean; quarantine: boolean };

export async function runCleanup(plan: CleanupPlan, report: SpaceReport): Promise<{ freed: number; deleted: number }> {
  let freed = 0, deleted = 0;
  if (plan.orphans) { const r = deleteFiles(report.orphans.map((f) => f.uri)); deleted += r.deleted; freed += report.orphanBytes; }
  if (plan.cache) { const r = deleteFiles(report.cacheFiles.map((f) => f.uri)); deleted += r.deleted; freed += report.cacheBytes; }
  const sql = asSql(realBackend());
  if (plan.quarantine && sql) await sql.quarantineClear();
  try { const m = await realBackend()?.maintain(true); if (m?.bytesBefore && m.bytesAfter) freed += Math.max(0, m.bytesBefore - m.bytesAfter); } catch { /* ignore */ }
  return { freed, deleted };
}

export async function optimizeNow(): Promise<{ vacuumed: boolean; bytesBefore?: number; bytesAfter?: number }> {
  const b = realBackend();
  if (!b) return { vacuumed: false };
  await getEngine().flush();
  return b.maintain(true);
}

export async function quarantineSummary() {
  const sql = asSql(realBackend());
  return sql ? sql.quarantineList() : [];
}

/** Manutenzione periodica leggera (una volta al giorno): ottimizzazione, VACUUM raro, avviso se lo spazio e' poco. */
let scheduled = false;
export function scheduleMaintenance(delayMs = 8000) {
  if (scheduled) return;
  scheduled = true;
  setTimeout(async () => {
    try {
      const d = diskSpace();
      if (d && isLowSpace(d.available, d.total)) pushNotice({ kind: 'low_space', level: 'warn', message: 'Lo spazio sul telefono sta finendo: potrebbe non essere possibile salvare nuovi dati. Libera spazio o ripulisci da Sicurezza.' });
      const last = useSecurity.getState().lastMaintenanceAt;
      if (Date.now() - last < 24 * 3600_000) return;
      await getEngine().ready();
      await realBackend()?.maintain(false);
      useSecurity.getState().set({ lastMaintenanceAt: Date.now() });
    } catch { /* la manutenzione non deve mai disturbare */ }
  }, delayMs);
}
