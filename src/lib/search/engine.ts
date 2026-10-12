import { ftsAvailable, FtsIndex } from './fts.ts';
import { MemoryIndex } from './memory.ts';
import type { SearchDoc, SearchHit, SearchIndex, SearchOptions } from './types.ts';
import type { SqlDriver } from '../../db/types.ts';

/**
 * Motore di ricerca: FTS5 se `openMemoryDb` fornisce un SQLite con FTS5, altrimenti ricerca in memoria. Stessa API.
 * `getDocs` e' chiamato a ogni reindicizzazione. Puro: le dipendenze sono iniettate.
 */
export type SearchEngineDeps = { getDocs: () => SearchDoc[]; openMemoryDb?: () => Promise<SqlDriver | null> };

export class SearchEngine {
  private idx: SearchIndex | null = null;
  private opening: Promise<SearchIndex> | null = null;
  private dirty = true;
  private d: SearchEngineDeps;
  lastSync = { ms: 0, docs: 0 };
  constructor(d: SearchEngineDeps) { this.d = d; }

  private open(): Promise<SearchIndex> {
    if (!this.opening) {
      this.opening = (async () => {
        try {
          const db = await this.d.openMemoryDb?.();
          if (db && (await ftsAvailable(db))) return (this.idx = new FtsIndex(db));
        } catch { /* niente FTS5: ripiego */ }
        return (this.idx = new MemoryIndex());
      })();
    }
    return this.opening;
  }

  get kind(): 'fts5' | 'memory' | 'closed' { return this.idx?.kind ?? 'closed'; }
  markDirty() { this.dirty = true; }

  async reindex(): Promise<{ added: number; updated: number; removed: number }> {
    const idx = await this.open();
    const t0 = Date.now();
    const docs = this.d.getDocs();
    const r = await idx.sync(docs);
    this.dirty = false;
    this.lastSync = { ms: Date.now() - t0, docs: docs.length };
    return r;
  }

  async searchAll(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    const idx = await this.open();
    if (this.dirty) await this.reindex();
    try {
      return await idx.search(query, opts);
    } catch {
      // un'espressione MATCH imprevista non deve mai rompere la schermata: ripiego sulla ricerca in memoria
      if (idx.kind === 'fts5') { const m = new MemoryIndex(); await m.sync(this.d.getDocs()); return m.search(query, opts); }
      return [];
    }
  }

  async clear() { await this.idx?.clear(); this.dirty = true; }
}
