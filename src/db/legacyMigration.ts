import type { Notify } from './types.ts';
import type { SqlKvBackend } from './sqlKv.ts';

/**
 * Migrazione one-shot da AsyncStorage (`lp2-*`) a SQLite.
 * Fasi (salvate nella tabella meta, chiave "legacy"): nessuna -> copied (copia verificata, vecchi dati tenuti) -> purged.
 * Idempotente e interrompibile: si puo' rilanciare in qualunque momento; non sovrascrive mai dati gia' presenti in SQLite.
 */
export interface LegacySource {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

export const LEGACY_RETAIN_DAYS = 14;

/** JSON con chiavi ordinate: confronto semantico (gli store a pezzi ricompongono i campi in un altro ordine). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v);
}
const sameJson = (a: string, b: string) => a === b || canonical(JSON.parse(a)) === canonical(JSON.parse(b));
const DAY = 86_400_000;

export type LegacyState = { phase: 'copied' | 'purged'; at: number; deleteAfter?: number; keys?: string[]; copied?: number; skipped?: number; invalid?: string[] };

export type LegacyOutcome = { action: 'none' | 'copied' | 'waiting' | 'purged' | 'already'; copied?: number; keys?: number };

export async function runLegacyMigration(o: { source: LegacySource; backend: SqlKvBackend; prefix?: string; now?: () => number; retainDays?: number; notify?: Notify }): Promise<LegacyOutcome> {
  const prefix = o.prefix ?? 'lp2-';
  const now = (o.now ?? Date.now)();
  const retain = (o.retainDays ?? LEGACY_RETAIN_DAYS) * DAY;
  const raw = await o.backend.getMeta('legacy');
  let state: LegacyState | null = null;
  try { state = raw ? (JSON.parse(raw) as LegacyState) : null; } catch { state = null; }

  if (state?.phase === 'purged') return { action: 'already' };

  if (state?.phase === 'copied') {
    if (state.deleteAfter && now >= state.deleteAfter) {
      const present = new Set(await o.source.getAllKeys());
      const toRemove = (state.keys ?? []).filter((k) => present.has(k));
      if (toRemove.length) await o.source.multiRemove(toRemove);
      await o.backend.setMeta('legacy', JSON.stringify({ ...state, phase: 'purged', keys: undefined, deleteAfter: undefined } satisfies LegacyState));
      return { action: 'purged', keys: toRemove.length };
    }
    return { action: 'waiting' };
  }

  const keys = (await o.source.getAllKeys()).filter((k) => k.startsWith(prefix));
  if (!keys.length) {
    await o.backend.setMeta('legacy', JSON.stringify({ phase: 'purged', at: now, copied: 0 } satisfies LegacyState));
    return { action: 'none' };
  }
  const pairs = await o.source.multiGet(keys);
  const entries: Record<string, string> = {};
  const versions: Record<string, number> = {};
  const invalid: string[] = [];
  for (const [k, v] of pairs) {
    if (typeof v !== 'string') continue;
    try {
      const p = JSON.parse(v);
      if (!p || typeof p !== 'object' || !p.state || typeof p.state !== 'object') throw new Error('forma');
      entries[k] = v;
      versions[k] = typeof p.version === 'number' ? p.version : 0;
    } catch {
      invalid.push(k);
      try { await o.backend.quarantine(k, v, 'migrazione da AsyncStorage: JSON non valido'); } catch { /* ignore */ }
    }
  }
  const inserted = await o.backend.adoptMissing(entries, versions);
  // verifica: rileggo da SQLite e confronto con l'originale
  if (inserted.length) {
    const { values, bad } = await o.backend.readAll();
    const failures = inserted.filter((n) => bad.includes(n) || values[n] === undefined || !sameJson(values[n], entries[n]));
    if (failures.length) throw new Error('Verifica della migrazione fallita per: ' + failures.join(', '));
  }
  const st: LegacyState = { phase: 'copied', at: now, deleteAfter: now + retain, keys: Object.keys(entries).concat(invalid), copied: inserted.length, skipped: Object.keys(entries).length - inserted.length, invalid };
  await o.backend.setMeta('legacy', JSON.stringify(st));
  o.notify?.({ kind: 'migrated_legacy', level: 'info', message: 'Dati spostati nel nuovo archivio. La copia precedente resta come rete di sicurezza per 14 giorni.' });
  return { action: 'copied', copied: inserted.length, keys: keys.length };
}
