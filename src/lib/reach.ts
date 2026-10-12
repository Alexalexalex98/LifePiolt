/**
 * Diffusione dei contenuti nel feed (modulo PURO). Il funzionamento NON è mostrato agli utenti: qui ci sono solo i numeri.
 * Ogni azione apre il contenuto a nuove persone nella Home "Per te": premia ciò che dà valore (idee sostenute, LifePoint donati).
 */
export type ReachKind = 'like' | 'comment' | 'share' | 'daily' | 'idea';
export const REACH_BOOST: Record<ReachKind, number> = { like: 5, comment: 10, share: 5, daily: 50, idea: 50 };
export const reachOf = (reach: Record<string, number> | undefined, key: string): number => reach?.[key] ?? 0;
/** Ordina in modo stabile: più diffusione prima, a parità resta l'ordine di partenza. */
export function byReach<T>(items: T[], keyOf: (x: T) => string, reach: Record<string, number> | undefined): T[] {
  return items.map((x, i) => ({ x, i, r: reachOf(reach, keyOf(x)) })).sort((a, b) => b.r - a.r || a.i - b.i).map((v) => v.x);
}
