export type SearchType = 'note' | 'task' | 'goal' | 'file' | 'event' | 'chat' | 'bill' | 'idea' | 'post';
export const SEARCH_TYPES: SearchType[] = ['note', 'task', 'goal', 'file', 'event', 'chat', 'bill', 'idea', 'post'];

export type SearchDoc = {
  /** unico dentro il tipo */
  id: string;
  type: SearchType;
  title: string;
  text: string;
  /** peso di recenza (timestamp o 0): a parita' di punteggio vince il piu' recente */
  ts?: number;
};

export type SearchHit = {
  type: SearchType;
  id: string;
  title: string;
  /** frammento con evidenziazione: i termini trovati sono racchiusi tra \u0001 e \u0002 (vedi parseHighlight) */
  snippet: string;
  /** piu' basso = piu' rilevante (BM25) */
  score: number;
  /** rimando alla chat/giorno di appartenenza, quando serve */
  ref?: string;
};

export type SearchOptions = { types?: SearchType[]; limit?: number };

/** Interfaccia comune a indice FTS5 e ricerca in memoria. */
export interface SearchIndex {
  readonly kind: 'fts5' | 'memory';
  /** Allinea l'indice ai documenti dati (incrementale: aggiunge, aggiorna, toglie). */
  sync(docs: SearchDoc[]): Promise<{ added: number; updated: number; removed: number }>;
  search(query: string, opts?: SearchOptions): Promise<SearchHit[]>;
  count(): number;
  clear(): Promise<void>;
}

export const HL_START = '\u0001';
export const HL_END = '\u0002';

/** Spezza una stringa evidenziata in segmenti { text, hit }. */
export function parseHighlight(s: string): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  let hit = false, buf = '';
  for (const ch of s) {
    if (ch === HL_START) { if (buf) out.push({ text: buf, hit }); buf = ''; hit = true; }
    else if (ch === HL_END) { if (buf) out.push({ text: buf, hit }); buf = ''; hit = false; }
    else buf += ch;
  }
  if (buf) out.push({ text: buf, hit });
  return out;
}
export const stripHighlight = (s: string) => s.replace(/[\u0001\u0002]/g, '');
