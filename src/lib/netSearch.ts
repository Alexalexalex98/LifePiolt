/**
 * Ricerca unica di LifeNetwork (modulo PURO, nessun alias '@/'): una sola barra per persone, post, idee, seminari, servizi, prodotti,
 * community e lavori. Ignora maiuscole e accenti, richiede che ogni parola scritta compaia e mette in alto i titoli che iniziano con ciò che scrivi.
 */
export type SearchKind = 'persona' | 'post' | 'idea' | 'seminario' | 'servizio' | 'prodotto' | 'community' | 'lavoro';
export const SEARCH_KINDS: SearchKind[] = ['persona', 'post', 'idea', 'seminario', 'servizio', 'prodotto', 'community', 'lavoro'];
export const KIND_LABEL: Record<SearchKind, string> = { persona: 'Persone', post: 'Post', idea: 'Idee', seminario: 'Seminari', servizio: 'Servizi', prodotto: 'Prodotti', community: 'Community', lavoro: 'Lavori' };
export type SearchDoc = { kind: SearchKind; id: string; title: string; sub?: string; text?: string };
export type SearchHit = SearchDoc & { score: number };

export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Punteggio di un documento per la ricerca scritta (0 = non corrisponde). */
export function scoreDoc(d: SearchDoc, query: string): number {
  const tokens = norm(query).split(' ').filter(Boolean);
  if (!tokens.length) return 0;
  const title = norm(d.title), sub = norm(d.sub ?? ''), text = norm(d.text ?? '');
  let total = 0;
  for (const tk of tokens) {
    let s = 0;
    if (title.startsWith(tk)) s = 6;
    else if (title.split(' ').some((w) => w.startsWith(tk))) s = 4;
    else if (title.includes(tk)) s = 2.5;
    else if (sub.includes(tk)) s = 1.5;
    else if (text.includes(tk)) s = 1;
    if (!s) return 0;
    total += s;
  }
  return total;
}

/** Risultati ordinati per punteggio, al massimo `per` per tipo (0 = nessun limite) e filtrabili per tipo. */
export function searchAll(docs: SearchDoc[], query: string, opts: { kind?: SearchKind | null; per?: number } = {}): SearchHit[] {
  if (norm(query).length < 1) return [];
  const hits = docs.filter((d) => !opts.kind || d.kind === opts.kind).map((d, i) => ({ d, i, s: scoreDoc(d, query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
  const per = opts.per ?? 0, count: Partial<Record<SearchKind, number>> = {}, out: SearchHit[] = [];
  for (const x of hits) { const n = count[x.d.kind] ?? 0; if (per && n >= per) continue; count[x.d.kind] = n + 1; out.push({ ...x.d, score: x.s }); }
  return out;
}

/** Raggruppa per tipo mantenendo l'ordine di SEARCH_KINDS (persone per prime). */
export function groupHits(hits: SearchHit[]): { kind: SearchKind; hits: SearchHit[] }[] {
  return SEARCH_KINDS.map((kind) => ({ kind, hits: hits.filter((h) => h.kind === kind) })).filter((g) => g.hits.length);
}
