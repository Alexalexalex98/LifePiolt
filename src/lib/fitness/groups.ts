/**
 * Gruppi di allenamento (modulo PURO). Una persona crea il gruppo: gratuito (ci si aggrega per allenarsi insieme, chi organizza
 * accetta o rifiuta le richieste) o a pagamento (si paga in LifePoints per 30 giorni). Ogni gruppo ha la sua community.
 * Fino a 5 persone non ci sono limiti; sopra le 5 (fino a 30) in un centro convenzionato si può entrare solo nelle fasce orarie
 * che il centro riserva ai gruppi, e a una stessa ora c'è un solo gruppo grande per centro: così non si satura.
 */
import type { Gym } from './data.ts';

export const SMALL_GROUP = 5;
export const MAX_GROUP = 30;
export const MAX_PRICE_LP = 300;
const DAY = 86400000;
export const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export type GroupLevel = 'tutti' | 'principiante' | 'intermedio' | 'avanzato';
export type FitGroup = {
  id: string; ts: number; name: string; owner: string; kind: 'free' | 'paid'; priceLP: number; max: number; level: GroupLevel;
  desc: string; city: string; gymId?: string; /** 0 = lunedì */ day?: number; /** ora d'inizio, durata 1 ora */ hour?: number;
  communityId: number; members: string[]; requests: { name: string; ts: number }[]; declined: string[];
  /** gruppi a pagamento: fino a quando ha pagato ciascuno */ paidUntil: Record<string, number>; demo?: boolean;
};

export type Slot = { days: number[]; from: number; to: number };
/** Fasce in cui un centro accetta gruppi grandi (sopra le 5 persone). */
export function gymSlots(gym: Pick<Gym, 'kind'>): Slot[] {
  if (gym.kind === 'piscina') return [{ days: [0, 1, 2, 3, 4], from: 10, to: 15 }];
  if (gym.kind === 'centro') return [{ days: [0, 1, 2, 3, 4], from: 9, to: 17 }, { days: [6], from: 9, to: 13 }];
  return [{ days: [0, 1, 2, 3, 4], from: 9, to: 16 }, { days: [5], from: 8, to: 12 }];
}
/** Quante persone al massimo in un gruppo in quel centro. */
export const gymGroupMax = (gym: Pick<Gym, 'kind'>): number => (gym.kind === 'piscina' ? 20 : MAX_GROUP);
export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
export function slotLabel(s: Slot): string {
  const d = s.days;
  const days = d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1] + 1) ? `${WEEKDAYS[d[0]].slice(0, 3)}–${WEEKDAYS[d[d.length - 1]].slice(0, 3)}` : d.map((x) => WEEKDAYS[x].slice(0, 3)).join(', ');
  return `${days} ${hourLabel(s.from)}–${hourLabel(s.to)}`;
}
/** Giorni e ore d'inizio permessi a un gruppo grande in quel centro. */
export function allowedStarts(gym: Pick<Gym, 'kind'>): { day: number; hour: number }[] {
  const out: { day: number; hour: number }[] = [];
  for (const s of gymSlots(gym)) for (const day of s.days) for (let h = s.from; h < s.to; h++) out.push({ day, hour: h });
  return out.sort((a, b) => a.day - b.day || a.hour - b.hour);
}

export type GroupInput = { name: string; kind: 'free' | 'paid'; priceLP: number; max: number; gym?: Pick<Gym, 'id' | 'kind' | 'name'> | null; day?: number; hour?: number };
/** Motivi per cui il gruppo non si può creare così (vuoto = va bene). */
export function validateGroup(i: GroupInput, others: FitGroup[]): string[] {
  const out: string[] = [];
  if (i.name.trim().length < 3) out.push('Dai un nome al gruppo (almeno 3 lettere).');
  if (!Number.isInteger(i.max) || i.max < 2 || i.max > MAX_GROUP) out.push(`Un gruppo ha da 2 a ${MAX_GROUP} persone.`);
  if (i.kind === 'paid' && (!Number.isInteger(i.priceLP) || i.priceLP < 1 || i.priceLP > MAX_PRICE_LP)) out.push(`Il prezzo va da 1 a ${MAX_PRICE_LP} LP al mese.`);
  if (i.gym) {
    if (i.day == null || i.hour == null) out.push('Scegli giorno e ora dell’allenamento nel centro.');
    else if (i.max > SMALL_GROUP) {
      const cap = gymGroupMax(i.gym);
      if (i.max > cap) out.push(`${i.gym.name} accetta gruppi fino a ${cap} persone.`);
      if (!allowedStarts(i.gym).some((s) => s.day === i.day && s.hour === i.hour)) out.push(`Sopra le ${SMALL_GROUP} persone ${i.gym.name} accetta gruppi solo in queste fasce: ${gymSlots(i.gym).map(slotLabel).join(' · ')}.`);
      else if (others.some((g) => g.gymId === i.gym!.id && g.max > SMALL_GROUP && g.day === i.day && g.hour === i.hour)) out.push('A quell’ora c’è già un altro gruppo grande in questo centro: scegli un altro orario.');
    }
  }
  return out;
}

export type GroupState = 'owner' | 'member' | 'expired' | 'pending' | 'declined' | 'full' | 'open';
export const isFull = (g: FitGroup) => g.members.length >= g.max;
export function groupState(g: FitGroup, me: string, now = Date.now()): GroupState {
  if (g.owner === me) return 'owner';
  if (g.members.includes(me)) return g.kind === 'paid' && (g.paidUntil[me] ?? 0) <= now ? 'expired' : 'member';
  if (g.requests.some((r) => r.name === me)) return 'pending';
  if (g.declined.includes(me)) return 'declined';
  return isFull(g) ? 'full' : 'open';
}
export const PAID_DAYS = 30;
export const paidUntil = (now: number) => now + PAID_DAYS * DAY;
export const daysLeft = (until: number, now = Date.now()) => Math.max(0, Math.ceil((until - now) / DAY));
export function scheduleLabel(g: Pick<FitGroup, 'day' | 'hour'>): string { return g.day == null || g.hour == null ? 'Orario da concordare' : `${WEEKDAYS[g.day]} alle ${hourLabel(g.hour)}`; }
