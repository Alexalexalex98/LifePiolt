import { isPlainObject, repairState, type RepairReport, type Schema } from './schemaKit.ts';
import { SCHEMAS, SENSITIVE_STORES, SHARDS } from './schemas.ts';
import type { ShardSpec } from './shardPlan.ts';

/**
 * Registro centrale delle versioni di schema per store.
 * - version 1 = stato di LifePilot prima dell'engine SQLite (i vecchi dati hanno version 0 o 1 e restano identici).
 * - Per cambiare lo schema di uno store: alza `version` e aggiungi in `migrations[<nuova versione>]` la funzione
 *   che trasforma lo stato dalla versione precedente. Le migrazioni sono pure e devono tollerare campi mancanti.
 */
export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;
export type StoreSpec = { version: number; migrations?: Record<number, Migration>; schema?: Schema; sensitive?: boolean; /** campi grandi salvati in righe separate (vedi shardPlan.ts) */ shards?: ShardSpec };

export const CURRENT_SCHEMA_VERSION = 1;

const NAMES = ['app', 'life', 'health', 'finance', 'travel', 'network', 'chat', 'jobs', 'context', 'assistant', 'discover', 'prefs', 'theia', 'interests', 'club', 'identity', 'sharing', 'tour', 'live', 'aiRouter', 'calprefs', 'moderation', 'security', 'fitness'];

const REGISTRY: Record<string, StoreSpec> = {};
for (const n of NAMES) REGISTRY[n] = { version: CURRENT_SCHEMA_VERSION, schema: SCHEMAS[n], sensitive: SENSITIVE_STORES.includes(n), shards: SHARDS[n] };

/** Registra o sovrascrive la specifica di uno store (usato da persisted(name, ..., { version, migrate, schema })). */
export function registerStore(name: string, spec: Partial<StoreSpec>) {
  const cur = REGISTRY[name] ?? { version: CURRENT_SCHEMA_VERSION };
  REGISTRY[name] = { ...cur, ...Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== undefined)) } as StoreSpec;
}

export const stripPrefix = (key: string) => (key.startsWith('lp2-') ? key.slice(4) : key);

export function specFor(name: string): StoreSpec {
  return REGISTRY[stripPrefix(name)] ?? { version: CURRENT_SCHEMA_VERSION };
}

export const shardSpecOf = (name: string): ShardSpec | undefined => specFor(name).shards;
export const isSensitive = (name: string) => !!specFor(name).sensitive;

export type PrepareResult =
  | { ok: true; value: { state: Record<string, unknown>; version: number }; report: RepairReport; migratedFrom?: number; future: boolean }
  | { ok: false; reason: string };

/** Porta uno stato letto dal disco alla versione corrente e lo ripara. Non lancia mai. */
export function prepareStored(name: string, stored: unknown): PrepareResult {
  const spec = specFor(name);
  if (!isPlainObject(stored) || !isPlainObject(stored.state)) return { ok: false, reason: 'forma non valida (manca "state")' };
  const from = typeof stored.version === 'number' && Number.isFinite(stored.version) ? stored.version : 0;
  const future = from > spec.version;
  let state = stored.state;
  if (!future) {
    for (let v = Math.max(from, 0) + 1; v <= spec.version; v++) {
      const m = spec.migrations?.[v];
      if (!m) continue;
      try { const next = m(state); if (isPlainObject(next)) state = next; } catch { /* migrazione fallita: tengo lo stato com'e', la riparazione fa il resto */ }
    }
  }
  const { state: repaired, report } = repairState(state, spec.schema);
  if (report.fatal) return { ok: false, reason: 'stato non valido' };
  return { ok: true, value: { state: repaired, version: future ? from : spec.version }, report, migratedFrom: from < spec.version ? from : undefined, future };
}

/** Funzione `migrate` per zustand/persist (rete di sicurezza: l'engine migra gia' in lettura). */
export function zustandMigrate(name: string) {
  return (persisted: unknown, version: number) => {
    const r = prepareStored(name, { state: persisted, version });
    return (r.ok ? r.value.state : {}) as never;
  };
}
