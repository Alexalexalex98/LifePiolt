/** Tipi condivisi dell'engine di persistenza (nessun import nativo: testabile in Node). */

export type SqlValue = string | number | null | Uint8Array;

/** Driver SQL minimo: lo implementano expo-sqlite (telefono) e node:sqlite (test). */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** BEGIN IMMEDIATE ... COMMIT; ROLLBACK se `fn` lancia. Le operazioni sono serializzate. */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type RawSqlOps = {
  exec(sql: string): Promise<void> | void;
  run(sql: string, params: SqlValue[]): Promise<{ changes: number }> | { changes: number };
  all(sql: string, params: SqlValue[]): Promise<unknown[]> | unknown[];
  close(): Promise<void> | void;
};

/** Rende seriale un driver grezzo: nessuna operazione si interpone dentro una transazione. */
export function serialDriver(raw: RawSqlOps): SqlDriver {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    const p = tail.then(job, job);
    tail = p.catch(() => undefined);
    return p;
  };
  const direct: SqlDriver = {
    exec: async (sql) => { await raw.exec(sql); },
    run: async (sql, params = []) => raw.run(sql, params),
    all: async <T,>(sql: string, params: SqlValue[] = []) => (await raw.all(sql, params)) as T[],
    transaction: () => { throw new Error('transazioni annidate non supportate'); },
    close: async () => { await raw.close(); },
  };
  return {
    exec: (sql) => enqueue(() => direct.exec(sql)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    all: <T,>(sql: string, params?: SqlValue[]) => enqueue(() => direct.all<T>(sql, params)),
    transaction: <T,>(fn: (tx: SqlDriver) => Promise<T>) => enqueue(async () => {
      await direct.exec('BEGIN IMMEDIATE');
      try {
        const r = await fn(direct);
        await direct.exec('COMMIT');
        return r;
      } catch (e) {
        try { await direct.exec('ROLLBACK'); } catch { /* connessione gia' chiusa */ }
        throw e;
      }
    }),
    close: () => enqueue(() => direct.close()),
  };
}

/** Eventi per l'utente: l'engine non perde mai dati in silenzio. */
export type DbNoticeKind =
  | 'disk_full' | 'write_failed' | 'recovered_backup' | 'recovered_repair' | 'quarantined' | 'db_corrupt_reset'
  | 'no_encryption' | 'future_version' | 'migrated_legacy' | 'key_unavailable' | 'low_space';

export type DbNotice = { id: string; kind: DbNoticeKind; message: string; store?: string; at: number; level: 'info' | 'warn' | 'error' };
export type Notify = (n: Omit<DbNotice, 'id' | 'at'>) => void;

/** Backend chiave-valore: SQLite (telefono) oppure AsyncStorage/localStorage (web, Expo Go senza SQLite). */
export interface KvBackend {
  readonly kind: 'sqlite' | 'asyncstorage' | 'memory';
  /** true se i dati sono cifrati a riposo (SQLCipher o cifratura per valore). */
  readonly encryption: 'sqlcipher' | 'value' | 'none';
  init(): Promise<void>;
  /** Legge TUTTO in una sola query: nome -> testo JSON (gia' decifrato e con checksum verificato). `bad` = nomi illeggibili. */
  readAll(): Promise<{ values: Record<string, string>; bad: string[]; /** store ricostruiti senza qualche pezzo illeggibile */ partial?: string[] }>;
  /** Ultima copia interna valida di uno store (rete di sicurezza), o null. */
  readBackup(name: string): Promise<string | null>;
  /** Scrive in una transazione sola. `versions` = versione dello schema per nome. */
  writeMany(entries: Record<string, string>, versions?: Record<string, number>): Promise<void>;
  remove(names: string[]): Promise<void>;
  /** Cancella ogni dato (incluse copie interne e quarantena). */
  clear(): Promise<void>;
  /** Solo SQLite: scrittura a pezzi di store grandi (vedi shardPlan.ts). Se assente l'engine usa writeMany. */
  isSharded?(name: string): boolean;
  writeStores?(items: { name: string; state: Record<string, unknown>; version: number }[], opts?: { verify?: boolean }): Promise<{ pieces: number; serialized: number }>;
  /** Comunica i riferimenti dello stato idratato, per non riscrivere cio' che non e' cambiato. */
  noteHydrated?(name: string, state: Record<string, unknown>): void;
  /** Scarta un valore illeggibile in quarantena per diagnosi. */
  quarantine(name: string, raw: string, reason: string): Promise<void>;
  /** Dimensioni per nome (byte approssimati) per la schermata Spazio occupato. */
  sizes(): Promise<{ name: string; bytes: number; updatedAt: number }[]>;
  /** Manutenzione: ottimizzazione e, ogni tanto, VACUUM. */
  maintain(force?: boolean): Promise<{ vacuumed: boolean; bytesBefore?: number; bytesAfter?: number }>;
  close(): Promise<void>;
}
