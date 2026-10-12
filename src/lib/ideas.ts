/**
 * Raccolta fondi delle idee (modulo PURO, nessun alias '@/').
 * I LifePoints donati non vanno al titolare finché l'obiettivo non è raggiunto. La raccolta dura al massimo 90 giorni (si sceglie alla pubblicazione):
 * se l'obiettivo non si raggiunge entro la scadenza, chi ha contribuito viene rimborsato.
 */
export const IDEA_MAX_DAYS = 90;
export const IDEA_PERIODS = [30, 60, 90] as const;
export const IDEA_DEFAULT_DAYS = 90;
const DAY = 86400000;

export type IdeaState = 'raccolta' | 'raggiunta' | 'scaduta';
type IdeaLike = { raised: number; target: number; ts?: number; days?: number };

export const clampDays = (d: unknown): number => (typeof d === 'number' && Number.isFinite(d) ? Math.max(1, Math.min(IDEA_MAX_DAYS, Math.round(d))) : IDEA_DEFAULT_DAYS);
export const ideaEnd = (i: IdeaLike): number | null => (typeof i.ts === 'number' ? i.ts + clampDays(i.days) * DAY : null);

/** Stato della raccolta: raggiunta appena si arriva all'obiettivo; scaduta se è passato il periodo senza arrivarci. */
export function ideaState(i: IdeaLike, now: number): IdeaState {
  if (i.target > 0 && i.raised >= i.target) return 'raggiunta';
  const end = ideaEnd(i);
  return end != null && now > end ? 'scaduta' : 'raccolta';
}
/** Giorni rimasti (arrotondati per eccesso); null se l'idea non ha data. */
export function daysLeft(i: IdeaLike, now: number): number | null {
  const end = ideaEnd(i);
  return end == null ? null : Math.max(0, Math.ceil((end - now) / DAY));
}
export const percentOf = (i: IdeaLike): number => (i.target > 0 ? Math.min(100, Math.round((i.raised / i.target) * 100)) : 0);
