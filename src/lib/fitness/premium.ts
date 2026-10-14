/** Abbonamento Premium e accessi ai centri (modulo PURO). Il Premium serve solo per entrare nei centri convenzionati. */
export const PREMIUM_PRICE_LP = 30;
export const PREMIUM_DAYS = 30;
const DAY = 86400000;
export type Sub = { since: number; renewsAt: number; autoRenew: boolean };
export type Visit = { id: string; gymId: string; ts: number };
export type PremiumState = 'nessuno' | 'attivo' | 'in-scadenza' | 'scaduto';

export function startSub(now: number): Sub { return { since: now, renewsAt: now + PREMIUM_DAYS * DAY, autoRenew: true }; }
export function premiumState(sub: Sub | null | undefined, now: number): PremiumState {
  if (!sub) return 'nessuno';
  if (now >= sub.renewsAt) return 'scaduto';
  return sub.autoRenew ? 'attivo' : 'in-scadenza';
}
export const hasAccess = (sub: Sub | null | undefined, now: number): boolean => { const s = premiumState(sub, now); return s === 'attivo' || s === 'in-scadenza'; };
export const daysLeft = (sub: Sub | null | undefined, now: number): number => (sub ? Math.max(0, Math.ceil((sub.renewsAt - now) / DAY)) : 0);

/** Alla scadenza rinnova da solo (se hai lasciato il rinnovo e hai i LifePoints); altrimenti l'abbonamento finisce. */
export function renewIfDue(sub: Sub | null | undefined, now: number, balance: number): { sub: Sub | null; charged: number; ended: boolean } {
  if (!sub || now < sub.renewsAt) return { sub: sub ?? null, charged: 0, ended: false };
  if (sub.autoRenew && balance >= PREMIUM_PRICE_LP) return { sub: { since: sub.renewsAt, renewsAt: sub.renewsAt + PREMIUM_DAYS * DAY, autoRenew: true }, charged: PREMIUM_PRICE_LP, ended: false };
  return { sub: null, charged: 0, ended: true };
}
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
export const MAX_GYMS_PER_DAY = 2;
/** Ingresso in un centro: serve il Premium attivo; un ingresso al giorno per centro e al massimo due centri diversi al giorno. */
export function checkIn(sub: Sub | null | undefined, visits: Visit[], gymId: string, now: number): { ok: boolean; reason?: string } {
  if (!hasAccess(sub, now)) return { ok: false, reason: 'Serve il Premium attivo per entrare nei centri convenzionati.' };
  const today = visits.filter((v) => sameDay(v.ts, now));
  if (today.some((v) => v.gymId === gymId)) return { ok: false, reason: 'Oggi sei già entrato in questo centro.' };
  if (new Set(today.map((v) => v.gymId)).size >= MAX_GYMS_PER_DAY) return { ok: false, reason: `Al massimo ${MAX_GYMS_PER_DAY} centri diversi al giorno.` };
  return { ok: true };
}
/** Ingressi per centro in un periodo: è la base per dividere i ricavi con i centri (la quota si stabilisce con loro). */
export function visitsByGym(visits: Visit[], from: number, to: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of visits) if (v.ts >= from && v.ts < to) out[v.gymId] = (out[v.gymId] ?? 0) + 1;
  return out;
}
/** Contenuto del pass mostrato all'ingresso (il centro lo legge e controlla la scadenza). */
export function passPayload(user: string, sub: Sub, now: number): string {
  return `lifepilot://gym-pass?u=${encodeURIComponent(user)}&exp=${sub.renewsAt}&t=${Math.floor(now / 60000)}`;
}
