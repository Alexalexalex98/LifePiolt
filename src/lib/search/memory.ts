import { HL_END, HL_START, type SearchDoc, type SearchHit, type SearchIndex, type SearchOptions } from './types.ts';
import { normalize, tokenize } from './normalize.ts';

type Entry = { doc: SearchDoc; nt: string; nx: string };

/** Ricerca in memoria (web, Expo Go senza FTS5): stessa API dell'indice FTS. Parole contenute (anche a meta' parola), tutte presenti. */
export class MemoryIndex implements SearchIndex {
  readonly kind = 'memory' as const;
  private m = new Map<string, Entry>();
  private key = (d: SearchDoc) => d.type + '\u0000' + d.id;

  async sync(docs: SearchDoc[]) {
    let added = 0, updated = 0, removed = 0;
    const seen = new Set<string>();
    for (const d of docs) {
      const k = this.key(d); seen.add(k);
      const cur = this.m.get(k);
      if (!cur) { this.m.set(k, { doc: d, nt: normalize(d.title), nx: normalize(d.text) }); added++; }
      else if (cur.doc.title !== d.title || cur.doc.text !== d.text) { this.m.set(k, { doc: d, nt: normalize(d.title), nx: normalize(d.text) }); updated++; }
      else cur.doc = d;
    }
    for (const k of [...this.m.keys()]) if (!seen.has(k)) { this.m.delete(k); removed++; }
    return { added, updated, removed };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    const toks = tokenize(query);
    if (!toks.length) return [];
    const limit = opts.limit ?? 50;
    const types = opts.types ? new Set(opts.types) : null;
    const hits: (SearchHit & { ts: number })[] = [];
    for (const e of this.m.values()) {
      if (types && !types.has(e.doc.type)) continue;
      let score = 0, ok = true;
      for (const t of toks) {
        const inT = e.nt.includes(t), inX = e.nx.includes(t);
        if (!inT && !inX) { ok = false; break; }
        score -= (inT ? 5 : 0) + (inX ? 1 : 0) + (e.nt.startsWith(t) ? 2 : 0);
      }
      if (!ok) continue;
      hits.push({ type: e.doc.type, id: e.doc.id, title: highlight(e.doc.title, toks), snippet: snippet(e.doc.text, toks), score, ts: e.doc.ts ?? 0 });
    }
    hits.sort((a, b) => a.score - b.score || b.ts - a.ts);
    return hits.slice(0, limit).map(({ ts: _ts, ...h }) => { void _ts; return h; });
  }

  count() { return this.m.size; }
  async clear() { this.m.clear(); }
}

/** Evidenzia i termini nel testo originale (la ricerca e' senza accenti, quindi mappo per posizione sul testo normalizzato lettera per lettera). */
export function highlight(text: string, toks: string[]): string {
  const low = normalize(text);
  // normalize() puo' cambiare la lunghezza (spazi): evidenzio solo se le lunghezze coincidono
  if (low.length !== text.length) return text;
  const marks = new Array<boolean>(text.length).fill(false);
  for (const t of toks) { let i = low.indexOf(t); while (i >= 0) { for (let k = i; k < i + t.length; k++) marks[k] = true; i = low.indexOf(t, i + t.length); } }
  let out = '', on = false;
  for (let i = 0; i < text.length; i++) {
    if (marks[i] && !on) { out += HL_START; on = true; } else if (!marks[i] && on) { out += HL_END; on = false; }
    out += text[i];
  }
  return on ? out + HL_END : out;
}

export function snippet(text: string, toks: string[], width = 80): string {
  if (!text) return '';
  const low = normalize(text);
  const same = low.length === text.length;
  let at = -1;
  if (same) for (const t of toks) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const from = Math.max(0, at < 0 ? 0 : at - 20);
  const part = text.slice(from, from + width);
  return (from > 0 ? '…' : '') + highlight(part, toks) + (from + width < text.length ? '…' : '');
}
