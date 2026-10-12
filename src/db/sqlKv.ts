import { checksum } from './checksum.ts';
import { shardSpecOf } from './migrations.ts';
import { commitPlan, joinJson, newMemo, pieceId, planShards, splitState, type ShardMemo, type ShardSpec } from './shardPlan.ts';
import type { KvBackend, SqlDriver } from './types.ts';

/** Cifratura per valore iniettata (quando SQLCipher non c'e'). */
export type ValueCodec = { shouldEncrypt(name: string): boolean; encode(name: string, plain: string): string; decode(name: string, stored: string): string };

export type SqlKvOptions = {
  driver: SqlDriver;
  now?: () => number;
  /** SQLCipher attivo (verificato con PRAGMA cipher_version). */
  sqlcipher?: boolean;
  codec?: ValueCodec | null;
  /** ogni quanto aggiornare la copia interna "ultimo valore valido" (default 10 minuti). */
  bakIntervalMs?: number;
  /** VACUUM al piu' ogni N giorni (default 30). */
  vacuumEveryDays?: number;
};

export const DB_SCHEMA_VERSION = 1;
const DAY = 86_400_000;

/** Migrazioni dello schema del DB stesso (PRAGMA user_version). La n-esima porta da n-1 a n. */
export const DB_MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS kv(name TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updatedAt INTEGER NOT NULL, checksum TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS kv_bak(name TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, checksum TEXT NOT NULL, updatedAt INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS quarantine(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value TEXT NOT NULL, reason TEXT, at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL)`,
    // pezzi degli store grandi (chat, piano...): una riga per campo o per chiave di mappa. key '' = campo intero, '#x' = chiave x.
    `CREATE TABLE IF NOT EXISTS shard(store TEXT NOT NULL, field TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, checksum TEXT NOT NULL, updatedAt INTEGER NOT NULL, PRIMARY KEY(store, field, key)) WITHOUT ROWID`,
  ],
];

const MAX_QUARANTINE_PER_STORE = 5;

export class SqlKvBackend implements KvBackend {
  readonly kind = 'sqlite' as const;
  private d: SqlDriver;
  private now: () => number;
  private codec: ValueCodec | null;
  private sqlcipher: boolean;
  private bakInterval: number;
  private vacuumDays: number;
  /** l'ultimo init ha riscontrato un controllo di integrita' fallito (solo per i test/diagnosi) */
  integrityOk = true;
  /** memoria per store a pezzi: checksum su disco e riferimenti dell'ultimo stato sincronizzato */
  private memos = new Map<string, ShardMemo>();
  private memo(name: string) { let m = this.memos.get(name); if (!m) { m = newMemo(); this.memos.set(name, m); } return m; }

  constructor(o: SqlKvOptions) {
    this.d = o.driver; this.now = o.now ?? Date.now; this.codec = o.codec ?? null; this.sqlcipher = !!o.sqlcipher;
    this.bakInterval = o.bakIntervalMs ?? 10 * 60_000; this.vacuumDays = o.vacuumEveryDays ?? 30;
  }

  get encryption(): 'sqlcipher' | 'value' | 'none' { return this.sqlcipher ? 'sqlcipher' : this.codec ? 'value' : 'none'; }

  private enc(name: string, plain: string) { return this.codec && !this.sqlcipher && this.codec.shouldEncrypt(name) ? this.codec.encode(name, plain) : plain; }
  private dec(name: string, stored: string) { return this.codec ? this.codec.decode(name, stored) : stored; }

  async init() {
    // WAL puo' non essere disponibile (es. :memory:): in quel caso l'errore e' innocuo
    try { await this.d.exec('PRAGMA journal_mode = WAL'); } catch { /* ignore */ }
    try { await this.d.exec('PRAGMA synchronous = NORMAL'); } catch { /* ignore */ }
    const row = (await this.d.all<{ user_version: number }>('PRAGMA user_version'))[0];
    let v = row?.user_version ?? 0;
    if (v > DB_SCHEMA_VERSION) throw new Error('Il database e\' stato creato da una versione piu\' recente dell\'app.');
    while (v < DB_SCHEMA_VERSION) {
      const steps = DB_MIGRATIONS[v];
      await this.d.transaction(async (tx) => { for (const sql of steps) await tx.exec(sql); await tx.exec(`PRAGMA user_version = ${v + 1}`); });
      v++;
    }
    // controllo di integrita' rapido al massimo una volta al giorno
    const last = Number((await this.getMeta('lastIntegrityCheck')) ?? 0);
    if (this.now() - last > DAY) {
      const r = await this.d.all<{ quick_check: string }>('PRAGMA quick_check(1)');
      this.integrityOk = (r[0]?.quick_check ?? 'ok') === 'ok';
      if (!this.integrityOk) throw new Error('integrity check fallito: database danneggiato');
      await this.setMeta('lastIntegrityCheck', String(this.now()));
    }
    await this.loadMemos();
  }

  /** Carica i checksum dei pezzi e delle teste (senza i valori): serve a capire cosa va riscritto. */
  private async loadMemos() {
    this.memos.clear();
    const rows = await this.d.all<{ store: string; field: string; key: string; checksum: string }>('SELECT store, field, key, checksum FROM shard');
    for (const r of rows) this.memo(r.store).sums.set(pieceId(r.field, r.key), r.checksum);
    const heads = await this.d.all<{ name: string; checksum: string }>('SELECT name, checksum FROM kv');
    for (const h of heads) if (shardSpecOf(h.name)) this.memo(h.name).head = h.checksum;
  }

  isSharded(name: string): boolean { const sp = shardSpecOf(name); return !!sp && Object.keys(sp).length > 0; }

  async getMeta(k: string): Promise<string | null> {
    const r = await this.d.all<{ v: string }>('SELECT v FROM meta WHERE k = ?', [k]);
    return r[0]?.v ?? null;
  }
  async setMeta(k: string, v: string) { await this.d.run('INSERT OR REPLACE INTO meta(k, v) VALUES(?, ?)', [k, v]); }

  async readAll() {
    const rows = await this.d.all<{ name: string; value: string; checksum: string }>('SELECT name, value, checksum FROM kv');
    const values: Record<string, string> = {};
    const bad: string[] = [];
    const partial: string[] = [];
    const heads: Record<string, string> = {};
    for (const r of rows) {
      if (checksum(r.value) !== r.checksum) { bad.push(r.name); continue; }
      try {
        heads[r.name] = this.dec(r.name, r.value);
        if (this.isSharded(r.name)) this.memo(r.name).head = heads[r.name] === r.value ? r.checksum : checksum(heads[r.name]);
      } catch { bad.push(r.name); }
    }
    const shardRows = await this.d.all<{ store: string; field: string; key: string; value: string; checksum: string }>('SELECT store, field, key, value, checksum FROM shard ORDER BY store, field, key');
    const byStore = new Map<string, { field: string; key: string; value: string }[]>();
    for (const r of shardRows) {
      let v: string | null = null;
      if (checksum(r.value) === r.checksum) { try { v = this.dec(r.store, r.value); } catch { v = null; } }
      if (v === null) {
        if (!partial.includes(r.store)) partial.push(r.store);
        try { await this.quarantine(r.store, r.value, `pezzo illeggibile: ${r.field}${r.key}`); } catch { /* ignore */ }
        continue;
      }
      this.memo(r.store).sums.set(pieceId(r.field, r.key), v === r.value ? r.checksum : checksum(v));
      const list = byStore.get(r.store) ?? [];
      list.push({ field: r.field, key: r.key, value: v });
      byStore.set(r.store, list);
    }
    for (const [name, head] of Object.entries(heads)) {
      const pieces = byStore.get(name);
      values[name] = pieces?.length ? joinJson(head, pieces) : head;
      byStore.delete(name);
    }
    // pezzi senza testa valida (testa corrotta/assente): la testa viene ricostruita da quella di backup, se c'e'
    for (const name of byStore.keys()) {
      if (!bad.includes(name) && !(name in heads)) bad.push(name);
    }
    return { values, bad, partial };
  }

  async readBackup(name: string): Promise<string | null> {
    const r = (await this.d.all<{ value: string; checksum: string }>('SELECT value, checksum FROM kv_bak WHERE name = ?', [name]))[0];
    if (!r || checksum(r.value) !== r.checksum) return null;
    let head: string;
    try { head = this.dec(name, r.value); } catch { return null; }
    if (!this.isSharded(name)) return head;
    // store a pezzi: la copia interna riguarda la testa; i pezzi sono quelli correnti (validi)
    const rows = await this.d.all<{ field: string; key: string; value: string; checksum: string }>('SELECT field, key, value, checksum FROM shard WHERE store = ? ORDER BY field, key', [name]);
    const pieces: { field: string; key: string; value: string }[] = [];
    for (const p of rows) { if (checksum(p.value) !== p.checksum) continue; try { pieces.push({ field: p.field, key: p.key, value: this.dec(name, p.value) }); } catch { /* scarto */ } }
    try { return pieces.length ? joinJson(head, pieces) : head; } catch { return null; }
  }

  async writeMany(entries: Record<string, string>, versions: Record<string, number> = {}) {
    const names = Object.keys(entries);
    if (!names.length) return;
    const plain: string[] = [];
    const sharded: { name: string; state: Record<string, unknown>; version: number }[] = [];
    for (const n of names) {
      if (this.isSharded(n)) {
        try {
          const p = JSON.parse(entries[n]) as { state?: Record<string, unknown>; version?: number };
          if (p && typeof p.state === 'object' && p.state) { sharded.push({ name: n, state: p.state, version: versions[n] ?? p.version ?? 1 }); continue; }
        } catch { /* non e' JSON: lo scrivo com'e' (sara' messo in quarantena alla lettura) */ }
      }
      plain.push(n);
    }
    if (sharded.length) await this.writeStores(sharded, { verify: true });
    if (!plain.length) return;
    // codifica/checksum FUORI dalla transazione: la transazione resta breve
    const prepared = plain.map((n) => { const stored = this.enc(n, entries[n]); return { n, stored, sum: checksum(stored), ver: versions[n] ?? 1 }; });
    const t = this.now();
    await this.d.transaction(async (tx) => {
      for (const p of prepared) await this.putHead(tx, p.n, p.stored, p.sum, p.ver, t);
    });
  }

  /** Scrive la riga principale di uno store, conservando prima una copia del valore precedente (al massimo ogni bakInterval). */
  private async putHead(tx: SqlDriver, name: string, stored: string, sum: string, ver: number, t: number) {
    await tx.run(
      `INSERT OR REPLACE INTO kv_bak(name, value, checksum, updatedAt)
       SELECT k.name, k.value, k.checksum, ? FROM kv k
       WHERE k.name = ? AND (NOT EXISTS (SELECT 1 FROM kv_bak b WHERE b.name = k.name) OR (SELECT b.updatedAt FROM kv_bak b WHERE b.name = k.name) <= ?)`,
      [t, name, t - this.bakInterval],
    );
    await tx.run('INSERT OR REPLACE INTO kv(name, value, version, updatedAt, checksum) VALUES(?, ?, ?, ?, ?)', [name, stored, ver, t, sum]);
  }

  noteHydrated(name: string, state: Record<string, unknown>) {
    const sp = shardSpecOf(name);
    if (!sp) return;
    const m = this.memo(name);
    for (const p of splitState(state, sp).pieces) m.refs.set(pieceId(p.field, p.key), p.value);
  }

  /**
   * Scrittura a pezzi. In una sola transazione: pezzi cambiati + testa + eliminazioni.
   * Senza `verify` si serializzano solo i pezzi il cui riferimento e' cambiato.
   */
  async writeStores(items: { name: string; state: Record<string, unknown>; version: number }[], opts: { verify?: boolean } = {}) {
    const t = this.now();
    type Job = { item: (typeof items)[number]; spec: ShardSpec; plan: ReturnType<typeof planShards>; memo: ShardMemo; headStored: string; headSum: string };
    const jobs: Job[] = [];
    let serialized = 0, pieces = 0;
    for (const item of items) {
      const spec = shardSpecOf(item.name) ?? {};
      const memo = this.memo(item.name);
      const plan = planShards(item.state, item.version, spec, memo, !!opts.verify);
      serialized += plan.serialized; pieces += plan.total;
      if (!plan.headChanged && !plan.upserts.length && !plan.deletes.length) continue;
      const headStored = this.enc(item.name, plan.headJson);
      jobs.push({ item, spec, plan, memo, headStored, headSum: checksum(headStored) });
    }
    if (!jobs.length) return { pieces, serialized };
    // codifica dei pezzi fuori dalla transazione
    const enc = jobs.map((j) => j.plan.upserts.map((u) => { const stored = this.enc(j.item.name, u.json); return { u, stored, sum: checksum(stored) }; }));
    await this.d.transaction(async (tx) => {
      for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        for (const e of enc[i]) await tx.run('INSERT OR REPLACE INTO shard(store, field, key, value, checksum, updatedAt) VALUES(?,?,?,?,?,?)', [j.item.name, e.u.field, e.u.key, e.stored, e.sum, t]);
        for (const d of j.plan.deletes) await tx.run('DELETE FROM shard WHERE store = ? AND field = ? AND key = ?', [j.item.name, d.field, d.key]);
        if (j.plan.headChanged || j.plan.upserts.length) await this.putHead(tx, j.item.name, j.headStored, j.headSum, j.item.version, t);
      }
    });
    // solo a transazione riuscita aggiorno la memoria
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      // la memoria tiene i checksum del testo IN CHIARO (quelli su disco possono essere di testo cifrato)
      commitPlan(j.item.state, j.spec, j.plan, j.memo);
    }
    return { pieces, serialized };
  }

  /** Migrazione da AsyncStorage: inserisce SOLO i nomi assenti (mai sovrascrive dati piu' recenti). Ritorna i nomi inseriti. */
  async adoptMissing(entries: Record<string, string>, versions: Record<string, number> = {}): Promise<string[]> {
    const inserted: string[] = [];
    const t = this.now();
    const have = new Set((await this.d.all<{ name: string }>('SELECT name FROM kv')).map((r) => r.name));
    const fresh = Object.keys(entries).filter((n) => !have.has(n));
    const shardedNames = fresh.filter((n) => this.isSharded(n));
    const plainNames = fresh.filter((n) => !this.isSharded(n));
    const prepared = plainNames.map((n) => { const stored = this.enc(n, entries[n]); return { n, stored, sum: checksum(stored), ver: versions[n] ?? 0 }; });
    await this.d.transaction(async (tx) => {
      for (const p of prepared) {
        const r = await tx.run('INSERT OR IGNORE INTO kv(name, value, version, updatedAt, checksum) VALUES(?, ?, ?, ?, ?)', [p.n, p.stored, p.ver, t, p.sum]);
        if (r.changes > 0) inserted.push(p.n);
      }
    });
    if (shardedNames.length) {
      const items = shardedNames.map((n) => { const p = JSON.parse(entries[n]) as { state: Record<string, unknown>; version?: number }; return { name: n, state: p.state, version: versions[n] ?? p.version ?? 0 }; });
      await this.writeStores(items, { verify: true });
      inserted.push(...shardedNames);
    }
    return inserted;
  }

  async remove(names: string[]) {
    if (!names.length) return;
    await this.d.transaction(async (tx) => { for (const n of names) { await tx.run('DELETE FROM kv WHERE name = ?', [n]); await tx.run('DELETE FROM kv_bak WHERE name = ?', [n]); await tx.run('DELETE FROM shard WHERE store = ?', [n]); } });
    for (const n of names) this.memos.delete(n);
  }

  async clear() {
    await this.d.transaction(async (tx) => {
      for (const t of ['kv', 'kv_bak', 'quarantine', 'shard']) await tx.run(`DELETE FROM ${t}`);
      await tx.run(`DELETE FROM meta WHERE k NOT IN ('lastIntegrityCheck')`);
    });
    this.memos.clear();
    try { await this.d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); await this.d.exec('VACUUM'); } catch { /* ignore */ }
  }

  async quarantine(name: string, raw: string, reason: string) {
    const stored = this.enc(name, raw);
    await this.d.transaction(async (tx) => {
      await tx.run('INSERT INTO quarantine(name, value, reason, at) VALUES(?, ?, ?, ?)', [name, stored, reason.slice(0, 200), this.now()]);
      await tx.run('DELETE FROM quarantine WHERE name = ? AND id NOT IN (SELECT id FROM quarantine WHERE name = ? ORDER BY id DESC LIMIT ?)', [name, name, MAX_QUARANTINE_PER_STORE]);
    });
  }

  async quarantineList(): Promise<{ id: number; name: string; reason: string; at: number; bytes: number }[]> {
    return this.d.all('SELECT id, name, reason, at, length(CAST(value AS BLOB)) AS bytes FROM quarantine ORDER BY id DESC');
  }
  async quarantineClear() { await this.d.run('DELETE FROM quarantine'); }

  async sizes() {
    const rows = await this.d.all<{ name: string; bytes: number; updatedAt: number }>(
      `SELECT name, SUM(bytes) AS bytes, MAX(updatedAt) AS updatedAt FROM (
         SELECT name, length(CAST(value AS BLOB)) AS bytes, updatedAt FROM kv
         UNION ALL SELECT store AS name, length(CAST(value AS BLOB)) AS bytes, updatedAt FROM shard
       ) GROUP BY name ORDER BY bytes DESC`,
    );
    return rows;
  }

  async fileBytes(): Promise<number> {
    const r = await this.d.all<{ n: number }>('SELECT page_count * page_size AS n FROM pragma_page_count(), pragma_page_size()');
    return r[0]?.n ?? 0;
  }

  async maintain(force = false) {
    const before = await this.fileBytes();
    try { await this.d.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch { /* ignore */ }
    try { await this.d.exec('PRAGMA optimize'); } catch { /* ignore */ }
    const lastV = Number((await this.getMeta('lastVacuum')) ?? 0);
    let vacuumed = false;
    if (force || this.now() - lastV > this.vacuumDays * DAY) {
      await this.d.exec('VACUUM');
      await this.setMeta('lastVacuum', String(this.now()));
      vacuumed = true;
    }
    return { vacuumed, bytesBefore: before, bytesAfter: await this.fileBytes() };
  }

  async close() { await this.d.close(); }
  get driver() { return this.d; }
}
