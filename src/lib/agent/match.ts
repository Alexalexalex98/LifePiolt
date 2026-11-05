/** Trovare «Giulia», «il preventivo Bianchi» o «sito nuovo» tra persone, progetti, clienti e task (modulo PURO, nessun alias '@/'). */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'del', 'della', 'dei', 'a', 'al', 'alla', 'da', 'per', 'con', 'e', 'srl', 'sa', 'spa', 'ag', 'gmbh']);
const tokens = (s: string) => norm(s).split(' ').filter((w) => w && !STOP.has(w));

/** Punteggio 0–1 di quanto `query` somiglia a `name`: parole in comune, prefissi, e il nome contenuto per intero. */
export function similarity(query: string, name: string): number {
  const q = tokens(query), n = tokens(name); if (!q.length || !n.length) return 0;
  const nq = norm(query), nn = norm(name);
  if (nq === nn) return 1;
  let hit = 0; for (const w of q) if (n.some((x) => x === w || (w.length >= 3 && (x.startsWith(w) || w.startsWith(x) && x.length >= 3)))) hit++;
  const cover = hit / q.length;
  const contain = nn.includes(nq) || nq.includes(nn) ? 0.15 : 0;
  return Math.min(1, cover * (0.6 + 0.4 * (hit / n.length)) + contain);
}
export type Found<T> = { item: T; score: number };
/** Il candidato migliore. Se due somigliano quasi allo stesso modo (ambiguo) restituisce `ambiguous`. */
export function findBest<T>(query: string | undefined, items: T[], nameOf: (x: T) => string, min = 0.5): { best?: Found<T>; ambiguous?: T[] } {
  if (!query?.trim()) return {};
  const ranked = items.map((item) => ({ item, score: similarity(query, nameOf(item)) })).filter((x) => x.score >= min).sort((a, b) => b.score - a.score);
  if (!ranked.length) return {};
  const top = ranked[0]!; const close = ranked.filter((x) => x.score >= top.score - 0.08 && x.score < 1);
  if (top.score < 1 && close.length > 1) return { ambiguous: close.map((x) => x.item) };
  return { best: top };
}
/** «Giulia Verdi» -> persona; «io», «me», «mi» -> me. */
export function findPerson<T extends { id: string; name: string }>(query: string | undefined, people: T[], meId: string | null): { best?: Found<T>; ambiguous?: T[]; me?: boolean } {
  if (!query) return {}; if (/^(io|me|mi|a me|mio|mia)$/i.test(query.trim())) return { me: true };
  const r = findBest(query, people, (p) => p.name, 0.45); const ans = r.best && r.best.item.id === meId ? { ...r, me: true } : r; return ans;
}
