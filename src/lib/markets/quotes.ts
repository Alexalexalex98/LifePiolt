/**
 * Prezzi dei titoli (modulo PURO: niente rete qui, solo lettura dei dati e calcoli).
 * Fonte prevista: file CSV pubblici in dollari, ritardati di circa 15 minuti; il cambio USD->CHF dà il valore in LifePoints
 * (1 LP = 1 franco). Prima del lancio serve un fornitore di dati con licenza commerciale.
 */
export type Quote = { price: number; open: number; high: number; low: number; /** chiusura del giorno prima, se nota */ prev?: number; date: string; time: string };

/** Codice del titolo presso la fonte dati. */
export const feedCode = (sym: string) => `${sym.toLowerCase()}.us`;
export const symFromFeed = (code: string) => code.toUpperCase().replace(/\.US$/, '');

const num = (s: string | undefined) => { const n = Number((s ?? '').trim()); return Number.isFinite(n) && (s ?? '').trim() !== '' ? n : NaN; };

/** CSV con intestazione tipo `Symbol,Date,Time,Open,High,Low,Close,Volume`. Le righe senza dati («N/D») si saltano. */
export function parseQuotesCsv(text: string): Record<string, Quote> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return {};
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const ix = (n: string) => head.indexOf(n);
  const iS = ix('symbol'), iD = ix('date'), iT = ix('time'), iO = ix('open'), iH = ix('high'), iL = ix('low'), iC = ix('close'), iP = Math.max(ix('prev'), ix('previous'));
  if (iS < 0 || iC < 0) return {};
  const out: Record<string, Quote> = {};
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    const price = num(c[iC]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const prev = iP >= 0 ? num(c[iP]) : NaN;
    out[symFromFeed(c[iS].trim())] = { price, open: Number.isFinite(num(c[iO])) ? num(c[iO]) : price, high: Number.isFinite(num(c[iH])) ? num(c[iH]) : price, low: Number.isFinite(num(c[iL])) ? num(c[iL]) : price, ...(Number.isFinite(prev) && prev > 0 ? { prev } : {}), date: (c[iD] ?? '').trim(), time: (c[iT] ?? '').trim() };
  }
  return out;
}
/** Storico giornaliero: `Date,Open,High,Low,Close,Volume` -> chiusure in ordine di data. */
export function parseHistoryCsv(text: string): number[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 3) return [];
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const iC = head.indexOf('close');
  if (iC < 0) return [];
  return lines.slice(1).map((l) => num(l.split(',')[iC])).filter((n) => Number.isFinite(n) && n > 0);
}
/** Spezza un elenco lungo in richieste da `size` titoli. */
export const chunk = <T,>(xs: T[], size: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size)); return out; };

/** Da dollari a LifePoints, al cambio USD->CHF. */
export const usdToLp = (usd: number, usdChf: number) => Math.round(usd * usdChf * 100) / 100;
export const FALLBACK_USDCHF = 0.88;

/** Variazione in percentuale rispetto a `base` (chiusura precedente o, se manca, apertura). */
export const changePct = (q: Pick<Quote, 'price' | 'open' | 'prev'>) => { const base = q.prev ?? q.open; return base > 0 ? ((q.price - base) / base) * 100 : 0; };

/* ---------- senza rete: prezzi dimostrativi che si muovono piano (stessi risultati a parità di titolo e minuto) ---------- */
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed: number) { let t = (seed + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
/** Prezzo dimostrativo: parte dall'ultimo noto e oscilla di poco (±2% al giorno circa), un passo ogni 5 minuti. */
export function simulatedPrice(sym: string, last: number, now: number): number {
  const slot = Math.floor(now / 300000);
  let p = last;
  for (let k = slot - 288; k <= slot; k++) p *= 1 + (rnd(hash(sym) ^ (k * 2654435761)) - 0.5) * 0.004;
  return Math.max(0.01, Math.round(p * 100) / 100);
}
/** Storico dimostrativo di `n` giorni che finisce al prezzo indicato. */
export function simulatedHistory(sym: string, price: number, n = 260): number[] {
  const out = new Array<number>(n);
  let p = price;
  for (let i = n - 1; i >= 0; i--) { out[i] = Math.round(p * 100) / 100; p /= 1 + (rnd(hash(sym) ^ (i * 40503)) - 0.48) * 0.03; }
  return out;
}
