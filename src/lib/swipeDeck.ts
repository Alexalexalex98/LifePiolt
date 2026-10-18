/**
 * Swipe sui post (modulo PURO): un post alla volta; a sinistra «mi interessa», a destra «non mi interessa».
 * Quelli che interessano tornano in «Per te» nell'ordine in cui li hai scelti; gli altri (e i simili) non si propongono più.
 */
import { scoreOf as rawScore, type ThemeWeights } from './relevance.ts';

/** Punteggio di un testo: si ricorda per ogni insieme di pesi, perché la stessa carta si valuta più volte a ogni scelta. */
let cacheW: ThemeWeights | undefined | null = null;
const cache = new Map<string, number>();
function scoreOf(text: string, weights: ThemeWeights | undefined): number {
  if (cacheW !== weights) { cacheW = weights; cache.clear(); }
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const v = rawScore(text, weights);
  if (cache.size > 2000) cache.clear();
  cache.set(text, v);
  return v;
}

export type SwipeDir = 'yes' | 'no';
export type SwipeRec = { key: string; dir: SwipeDir; ts: number };
export type DeckCard = { key: string; text: string; author: string };

/** Firma del contenuto di una carta: il primo file multimediale; due carte con la stessa firma si vedono uguali. */
const mediaSig = (c: { uri?: string; uris?: string[]; poster?: string; asset?: unknown }): string | null =>
  c.uris?.[0] ?? c.uri ?? c.poster ?? (typeof c.asset === 'number' ? `asset:${c.asset}` : null);

/** Toglie le carte doppie: stessa chiave, oppure stessa immagine/video (e stesso autore) anche se hanno chiavi diverse. */
export function dedupeCards<T extends DeckCard & { uri?: string; uris?: string[]; poster?: string; asset?: unknown }>(cards: T[]): T[] {
  const keys = new Set<string>(), sigs = new Set<string>(), out: T[] = [];
  for (const c of cards) {
    if (keys.has(c.key)) continue;
    const s = mediaSig(c);
    const id = s ? `${c.author}|${s}` : null;
    if (id && sigs.has(id)) continue;
    keys.add(c.key); if (id) sigs.add(id); out.push(c);
  }
  return out;
}

/** Sotto questo punteggio un post è «simile a quelli che non ti interessano» e non si propone più. */
export const HIDE_BELOW = -5;
export const SWIPE_SIGNAL = 3;

export const swipedKeys = (swipes: SwipeRec[] | undefined): Set<string> => new Set((swipes ?? []).map((s) => s.key));

/** Registra la scelta (se avevi già scelto quel post, vale l'ultima) e tiene l'elenco corto. */
export function record(swipes: SwipeRec[] | undefined, key: string, dir: SwipeDir, ts: number): SwipeRec[] {
  return [...(swipes ?? []).filter((s) => s.key !== key), { key, dir, ts }].slice(-1000);
}
/** Annulla l'ultima scelta (per il pulsante «Indietro»). */
export function undoLast(swipes: SwipeRec[] | undefined): { swipes: SwipeRec[]; undone: SwipeRec | null } {
  const l = swipes ?? [];
  return l.length ? { swipes: l.slice(0, -1), undone: l[l.length - 1] } : { swipes: l, undone: null };
}
/** Chiavi dei post che ti interessano, nell'ordine in cui li hai scelti. */
export const likedInOrder = (swipes: SwipeRec[] | undefined): string[] => (swipes ?? []).filter((s) => s.dir === 'yes').sort((a, b) => a.ts - b.ts).map((s) => s.key);
export const passedKeys = (swipes: SwipeRec[] | undefined): Set<string> => new Set((swipes ?? []).filter((s) => s.dir === 'no').map((s) => s.key));

/** Un post è nascosto se lo hai scartato, oppure se i suoi temi sono ormai molto scartati. */
export function isHidden(card: DeckCard, passed: Set<string>, weights: ThemeWeights | undefined): boolean {
  return passed.has(card.key) || scoreOf(card.text, weights) <= HIDE_BELOW;
}

/** Il prossimo da mostrare: non ancora scelto, non nascosto, il più adatto ai tuoi temi (a parità, l'ordine del feed). */
export function nextCard(cards: DeckCard[], swipes: SwipeRec[] | undefined, weights: ThemeWeights | undefined, me?: string): DeckCard | null {
  const seen = swipedKeys(swipes), passed = passedKeys(swipes);
  const pool = cards.filter((c) => !seen.has(c.key) && c.author !== me && !isHidden(c, passed, weights));
  if (!pool.length) return null;
  return pool.map((c, i) => ({ c, i, s: scoreOf(c.text, weights) })).sort((a, b) => b.s - a.s || a.i - b.i)[0].c;
}
/** Carte ancora da vedere, dalla più adatta alla meno adatta. */
export function rankedPool<T extends DeckCard>(cards: T[], swipes: SwipeRec[] | undefined, weights: ThemeWeights | undefined, me?: string): T[] {
  const seen = swipedKeys(swipes), passed = passedKeys(swipes);
  return cards.filter((c) => !seen.has(c.key) && c.author !== me && !isHidden(c, passed, weights)).map((c, i) => ({ c, i, s: scoreOf(c.text, weights) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.c);
}
/** Mescola foto e video: a turno (una carta sì e una no) si preferisce un video tra le prime proposte; se non ce ne sono, la prima in classifica. */
export function pickMixed<T extends DeckCard & { media?: 'photo' | 'video' | null }>(ranked: T[], position: number, window = 14): T | null {
  if (!ranked.length) return null;
  if (position % 2 === 0) { const v = ranked.slice(0, window).find((c) => c.media === 'video'); if (v) return v; }
  return ranked[0];
}
export const remaining = (cards: DeckCard[], swipes: SwipeRec[] | undefined, weights: ThemeWeights | undefined, me?: string): number => {
  const seen = swipedKeys(swipes), passed = passedKeys(swipes);
  return cards.filter((c) => !seen.has(c.key) && c.author !== me && !isHidden(c, passed, weights)).length;
};

/** «Per te»: via gli scartati e i simili, in cima quelli che ti interessano (nell'ordine dello swipe), poi il resto com'era. */
export function applyToFeed<T>(items: T[], keyOf: (x: T) => string | null, textOf: (x: T) => string, swipes: SwipeRec[] | undefined, weights: ThemeWeights | undefined): T[] {
  const passed = passedKeys(swipes);
  const liked = likedInOrder(swipes);
  const likedSet = new Set(liked);
  const byKey = new Map<string, T>();
  const rest: T[] = [];
  for (const it of items) {
    const k = keyOf(it);
    if (k && passed.has(k)) continue;
    if (k && likedSet.has(k)) { byKey.set(k, it); continue; }
    if (k && scoreOf(textOf(it), weights) <= HIDE_BELOW) continue;
    rest.push(it);
  }
  return [...liked.map((k) => byKey.get(k)).filter((x): x is T => x !== undefined), ...rest];
}

/**
 * Tempo passato su un post: più resti, più il tema ti interessa (anche se poi non scegli nulla).
 * Sotto 1,5 s è solo uno scorrimento veloce e non conta; ogni 6 s valgono 1 punto, fino a 2,5.
 * Per un video, averne visto almeno l'80% aggiunge 1 punto (tetto totale 3).
 */
export function dwellSignal(ms: number, videoFraction?: number): number {
  if (!(ms >= 1500)) return 0;
  const base = Math.min(2.5, Math.round((ms / 6000) * 10) / 10);
  const bonus = videoFraction !== undefined && videoFraction >= 0.8 ? 1 : 0;
  return Math.min(3, base + bonus);
}
