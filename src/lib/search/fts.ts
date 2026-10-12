import type { SqlDriver } from '../../db/types.ts';
import { tokenize } from './normalize.ts';
import { HL_END, HL_START, type SearchDoc, type SearchHit, type SearchIndex, type SearchOptions, type SearchType } from './types.ts';

/**
 * Indice SQLite FTS5 in un database IN MEMORIA (nessun testo in chiaro su disco, quindi non serve cifrarlo e non c'e' da migrarlo):
 * si ricostruisce all'avvio e si aggiorna in modo incrementale. Tokenizer unicode61 senza accenti e senza maiuscole, prefisso, BM25.
 */
export const FTS_DDL = `CREATE VIRTUAL TABLE IF NOT EXISTS doc USING fts5(title, text, type UNINDEXED, id UNINDEXED, tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3 4')`;

export async function ftsAvailable(d: SqlDriver): Promise<boolean> {
  try {
    await d.exec(`CREATE VIRTUAL TABLE temp.__fts_probe USING fts5(x)`);
    await d.exec(`DROP TABLE temp.__fts_probe`);
    return true;
  } catch { return false; }
}

const sig = (d: SearchDoc) => d.title.length + ':' + d.text.length + ':' + hashStr(d.title + '\u0000' + d.text);
function hashStr(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

export class FtsIndex implements SearchIndex {
  readonly kind = 'fts5' as const;
  private d: SqlDriver;
  private rows = new Map<string, { rowid: number; sig: string }>();
  private next = 1;
  private ready = false;
  constructor(driver: SqlDriver) { this.d = driver; }

  private async init() { if (!this.ready) { await this.d.exec(FTS_DDL); this.ready = true; } }
  private key = (d: { type: string; id: string }) => d.type + '\u0000' + d.id;

  async sync(docs: SearchDoc[]) {
    await this.init();
    let added = 0, updated = 0, removed = 0;
    const seen = new Set<string>();
    const todo: { d: SearchDoc; rowid?: number }[] = [];
    for (const doc of docs) {
      const k = this.key(doc); seen.add(k);
      const cur = this.rows.get(k);
      const s = sig(doc);
      if (!cur) todo.push({ d: doc }); else if (cur.sig !== s) todo.push({ d: doc, rowid: cur.rowid });
    }
    const gone = [...this.rows.entries()].filter(([k]) => !seen.has(k));
    if (!todo.length && !gone.length) return { added, updated, removed };
    // operazioni a blocchi (una istruzione per ~100 righe): meno passaggi dal JS al motore SQLite
    const delIds: number[] = gone.map(([, r]) => r.rowid);
    for (const [k] of gone) { this.rows.delete(k); removed++; }
    const ins: { rowid: number; d: SearchDoc }[] = [];
    for (const t of todo) {
      if (t.rowid !== undefined) { delIds.push(t.rowid); updated++; } else added++;
      const rowid = t.rowid ?? this.next++;
      ins.push({ rowid, d: t.d });
      this.rows.set(this.key(t.d), { rowid, sig: sig(t.d) });
    }
    try {
    await this.d.transaction(async (tx) => {
      for (let i = 0; i < delIds.length; i += 500) {
        const part = delIds.slice(i, i + 500);
        await tx.run(`DELETE FROM doc WHERE rowid IN (${part.map(() => '?').join(',')})`, part);
      }
      for (let i = 0; i < ins.length; i += 100) {
        const part = ins.slice(i, i + 100);
        await tx.run(`INSERT INTO doc(rowid, title, text, type, id) VALUES ${part.map(() => '(?,?,?,?,?)').join(',')}`, part.flatMap((p) => [p.rowid, p.d.title, p.d.text, p.d.type, p.d.id]));
      }
    });
    } catch (e) {
      // indice incoerente: lo svuoto, il prossimo sync lo ricostruisce da zero
      this.rows.clear();
      try { await this.d.exec('DELETE FROM doc'); } catch { /* ignore */ }
      throw e;
    }
    return { added, updated, removed };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    const toks = tokenize(query);
    if (!toks.length) return [];
    await this.init();
    const match = toks.map((t) => `"${t}"*`).join(' ');
    const types = opts.types?.length ? opts.types : null;
    const where = types ? ` AND type IN (${types.map(() => '?').join(',')})` : '';
    const sql = `SELECT type, id, highlight(doc, 0, ?, ?) AS title, snippet(doc, 1, ?, ?, '…', 14) AS snip, bm25(doc, 6.0, 1.0) AS score FROM doc WHERE doc MATCH ?${where} ORDER BY score LIMIT ?`;
    const rows = await this.d.all<{ type: SearchType; id: string; title: string; snip: string; score: number }>(sql, [HL_START, HL_END, HL_START, HL_END, match, ...(types ?? []), opts.limit ?? 50]);
    return rows.map((r) => ({ type: r.type, id: r.id, title: r.title, snippet: r.snip, score: r.score }));
  }

  count() { return this.rows.size; }
  async clear() { if (this.ready) await this.d.exec('DELETE FROM doc'); this.rows.clear(); }
}
