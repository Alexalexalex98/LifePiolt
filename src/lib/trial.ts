import { checksum } from '../db/checksum.ts';

/** La prova gratuita: 14 giorni dal primo accesso con l'account. Modulo PURO (si prova con node:test). */
export const TRIAL_DAYS = 14;
const DAY = 86400000;

/** Il giorno della prova (1 = il primo giorno), da 1 a TRIAL_DAYS; dopo resta TRIAL_DAYS. */
export function trialDay(startedAt: number, now: number): number {
  return Math.max(1, Math.min(TRIAL_DAYS, Math.floor((now - startedAt) / DAY) + 1));
}
export function trialDaysLeft(startedAt: number, now: number): number {
  return Math.max(0, TRIAL_DAYS - Math.floor((now - startedAt) / DAY));
}
export const trialExpired = (startedAt: number, now: number): boolean => trialDaysLeft(startedAt, now) === 0;

/** Giorni in cui Theia fa il punto con un feedback sui dati raccolti fin lì. */
export const NOTE_DAYS = [1, 3, 7, 10, 12, 14] as const;
export function dueNoteDay(day: number, last: number): number | null {
  const d = [...NOTE_DAYS].reverse().find((x) => x <= day && x > last);
  return d ?? null;
}

/** La modalità demo (per chi sviluppa) si apre con un codice: non è una vera protezione, ma tiene fuori chi non lo conosce. */
export const DEMO_CODE_HASH = '1cf71889930b4c:c';
export const demoCodeOk = (input: string): boolean => checksum(`lp-demo:${input.trim()}`) === DEMO_CODE_HASH;
