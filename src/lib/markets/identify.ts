/** Riconoscere un titolo da un testo (ricerca, risposta di Theia a uno screenshot). Modulo PURO. */
import { BY_SYM, CATALOG, type Instrument } from './catalog.ts';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/** Titoli che corrispondono alla ricerca, i più pertinenti prima: simbolo esatto, poi inizio del simbolo o del nome, poi il resto. */
export function searchInstruments(query: string, limit = 8): Instrument[] {
  const q = norm(query.trim());
  if (!q) return [];
  const score = (i: Instrument) => {
    const s = i.sym.toLowerCase(), n = norm(i.name);
    if (s === q) return 100;
    if (s.startsWith(q)) return 80;
    if (n.startsWith(q)) return 70;
    if (n.split(/[\s()&.-]+/).some((w) => w.startsWith(q))) return 60;
    if (n.includes(q)) return 40;
    if (norm(i.sector).includes(q)) return 10;
    return 0;
  };
  return CATALOG.map((i) => ({ i, s: score(i) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i.sym.localeCompare(b.i.sym)).slice(0, limit).map((x) => x.i);
}
/** Simbolo scritto in modo libero (anche non in elenco): lettere maiuscole, cifre, punto o trattino. */
export const looksLikeTicker = (s: string) => /^[A-Za-z]{1,5}([.-][A-Za-z])?$/.test(s.trim());

/** Cerca il titolo in un testo: JSON con `symbol`, `$AAPL`, `(AAPL)`, un simbolo dell'elenco in maiuscolo o il nome di un'azienda. */
export function extractTicker(text: string): string | null {
  if (!text) return null;
  const j = text.match(/"(?:symbol|ticker|simbolo)"\s*:\s*"([A-Za-z.\-]{1,8})"/);
  if (j) return j[1].toUpperCase();
  const d = text.match(/\$([A-Z]{1,5}(?:[.-][A-Z])?)\b/);
  if (d) return d[1];
  for (const m of text.matchAll(/\(([A-Z]{1,5}(?:[.-][A-Z])?)\)/g)) if (BY_SYM[m[1]]) return m[1];
  for (const m of text.matchAll(/\b([A-Z]{1,5}(?:-[A-Z])?)\b/g)) if (BY_SYM[m[1]] && m[1].length >= 2) return m[1];
  const n = norm(text);
  const byName = CATALOG.filter((i) => i.kind === 'azione' && n.includes(norm(i.name.replace(/\s*\(.*\)/, '')))).sort((a, b) => b.name.length - a.name.length)[0];
  return byName?.sym ?? null;
}
/** La richiesta che mandiamo a Theia con lo screenshot. */
export const SCREENSHOT_PROMPT = 'Questo è uno screenshot di un titolo finanziario. Rispondi SOLO con un JSON: {"symbol":"...","name":"...","price":numero oppure null,"currency":"..."}. Il simbolo è quello di borsa (es. AAPL).';
