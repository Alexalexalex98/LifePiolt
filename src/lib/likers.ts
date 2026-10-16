/**
 * «Chi ha messo mi piace» (modulo PURO). Senza un server che registri chi ha messo mi piace a cosa, l'elenco è un modello
 * dimostrativo: persone che conosci, scelte sempre nello stesso modo per lo stesso contenuto, tante quante i mi piace.
 */
function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export const MAX_LIKERS_SHOWN = 40;
export type Likers = { names: string[]; more: number };

/** `count` = mi piace del contenuto. Se l'hai messo tu compari per primo. Chi ha pubblicato non compare. */
export function likersFor(key: string, count: number, pool: string[], me: string, iLike: boolean, author?: string): Likers {
  const others = [...new Set(pool)].filter((n) => n && n !== me && n !== author).sort((a, b) => h32(key + '|' + a) - h32(key + '|' + b));
  const total = Math.max(0, count);
  const fromOthers = Math.max(0, total - (iLike ? 1 : 0));
  const shown = others.slice(0, Math.min(fromOthers, MAX_LIKERS_SHOWN - (iLike ? 1 : 0)));
  const names = iLike ? [me, ...shown] : shown;
  return { names, more: Math.max(0, total - names.length) };
}
