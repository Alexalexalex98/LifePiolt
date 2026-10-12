import type { SqlDriver } from './types.ts';

/**
 * Copia le tabelle di LifePilot da un database all'altro (es. da non cifrato a cifrato).
 * Il database di destinazione deve avere gia' lo schema (SqlKvBackend.init()). Idempotente: INSERT OR IGNORE.
 * Ritorna il numero di righe di `kv` copiate; lancia se il conteggio finale non coincide.
 */
export async function copyKvTables(from: SqlDriver, to: SqlDriver): Promise<number> {
  const kv = await from.all<{ name: string; value: string; version: number; updatedAt: number; checksum: string }>('SELECT name, value, version, updatedAt, checksum FROM kv');
  const bak = await from.all<{ name: string; value: string; checksum: string; updatedAt: number }>('SELECT name, value, checksum, updatedAt FROM kv_bak');
  const shards = await from.all<{ store: string; field: string; key: string; value: string; checksum: string; updatedAt: number }>('SELECT store, field, key, value, checksum, updatedAt FROM shard');
  const meta = await from.all<{ k: string; v: string }>('SELECT k, v FROM meta');
  const quar = await from.all<{ name: string; value: string; reason: string | null; at: number }>('SELECT name, value, reason, at FROM quarantine');
  await to.transaction(async (tx) => {
    for (const r of kv) await tx.run('INSERT OR IGNORE INTO kv(name, value, version, updatedAt, checksum) VALUES(?,?,?,?,?)', [r.name, r.value, r.version, r.updatedAt, r.checksum]);
    for (const r of bak) await tx.run('INSERT OR IGNORE INTO kv_bak(name, value, checksum, updatedAt) VALUES(?,?,?,?)', [r.name, r.value, r.checksum, r.updatedAt]);
    for (const r of shards) await tx.run('INSERT OR IGNORE INTO shard(store, field, key, value, checksum, updatedAt) VALUES(?,?,?,?,?,?)', [r.store, r.field, r.key, r.value, r.checksum, r.updatedAt]);
    for (const r of meta) await tx.run('INSERT OR IGNORE INTO meta(k, v) VALUES(?,?)', [r.k, r.v]);
    for (const r of quar) await tx.run('INSERT INTO quarantine(name, value, reason, at) VALUES(?,?,?,?)', [r.name, r.value, r.reason, r.at]);
  });
  const check = await to.all<{ n: number }>('SELECT count(*) AS n FROM kv');
  const names = new Set((await to.all<{ name: string }>('SELECT name FROM kv')).map((r) => r.name));
  if (!kv.every((r) => names.has(r.name))) throw new Error(`Copia non completa (${check[0]?.n ?? 0}/${kv.length})`);
  return kv.length;
}
