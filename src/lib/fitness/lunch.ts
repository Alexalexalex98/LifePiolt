/** Pausa pranzo (modulo PURO): quando chiedere «hai mangiato?» e quanto dura la pausa. */
export type LunchCfg = { on: boolean; from: string; to: string };
export const DEFAULT_LUNCH: LunchCfg = { on: false, from: '12:30', to: '13:30' };
export type LunchAnswer = 'si' | 'no';

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
/** Durata della pausa in minuti (almeno 15). */
export const lunchMinutes = (c: LunchCfg): number => Math.max(15, toMin(c.to) - toMin(c.from));

/** Chiedere «hai mangiato?» adesso: pausa attiva, siamo dentro l'orario, non hai già risposto sì oggi e non hai chiesto di aspettare. */
export function lunchAsk(i: { now: Date; cfg: LunchCfg | undefined; answer: LunchAnswer | undefined; snoozeUntil?: number }): boolean {
  const c = i.cfg;
  if (!c?.on || i.answer === 'si') return false;
  if (i.snoozeUntil && i.now.getTime() < i.snoozeUntil) return false;
  const m = i.now.getHours() * 60 + i.now.getMinutes();
  return m >= toMin(c.from) && m < toMin(c.to);
}
