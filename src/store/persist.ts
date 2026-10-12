import type { StateCreator } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import { getEngine } from '@/db';
import { registerStore, specFor, zustandMigrate } from '@/db/migrations';
import type { Schema } from '@/db/schemaKit';

export type PersistedOptions = {
  /** versione dello schema salvato (default: dal registro in src/db/migrations.ts) */
  version?: number;
  /** trasforma lo stato salvato dalla versione `fromVersion` alla successiva. Chiamata per ogni salto di versione. */
  migrate?: (state: Record<string, unknown>, fromVersion: number) => Record<string, unknown>;
  /** validazione leggera dei campi di primo livello (vedi src/db/schemaKit.ts) */
  schema?: Schema;
  /** cifra anche per valore (quando SQLCipher non c'e') */
  sensitive?: boolean;
};

/**
 * Salvataggio su dispositivo con chiave versionata `lp2-<name>`.
 * Dietro c'e' l'engine di src/db: SQLite (telefono) o localStorage (web), scritture coalescenti con debounce,
 * versione dello schema, riparazione dei dati corrotti. La firma e' retrocompatibile: gli store non cambiano.
 */
export function persisted<S>(name: string, creator: StateCreator<S, [['zustand/persist', unknown]], []>, partialize?: (s: S) => Partial<S>, opts?: PersistedOptions) {
  if (opts) {
    const cur = specFor(name);
    const version = opts.version ?? cur.version;
    const m = opts.migrate;
    const migrations = m
      ? Object.fromEntries(Array.from({ length: Math.max(0, version) }, (_, i) => [i + 1, (s: Record<string, unknown>) => m(s, i)]))
      : undefined;
    registerStore(name, { version, schema: opts.schema, sensitive: opts.sensitive, migrations: migrations ? { ...cur.migrations, ...migrations } : undefined });
  }
  const key = `lp2-${name}`;
  const storage: PersistStorage<S> = {
    getItem: async (k) => (await getEngine().getItem(k)) as StorageValue<S> | null,
    // sincrona e leggera: la serializzazione JSON avviene al flush (coalescente), non a ogni modifica
    setItem: (k, v) => { getEngine().set(k, v as unknown as { state: Record<string, unknown>; version?: number }); },
    removeItem: (k) => { getEngine().remove(k); },
  };
  return persist<S>(creator, {
    name: key,
    version: specFor(name).version,
    storage,
    migrate: zustandMigrate(name),
    ...(partialize ? { partialize: partialize as (s: S) => S } : {}),
  });
}
