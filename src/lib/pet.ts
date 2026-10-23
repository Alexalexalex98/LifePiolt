/**
 * Theia da accudire (modulo PURO): un piccolo animaletto virtuale che sta bene se ti prendi cura di te.
 * Il cibo non si compra: si GUADAGNA facendo le cose vere dell'app (task fatti, pasti e acqua segnati, allenamenti, umore).
 * Niente morte né punizioni: se la trascuri è triste e basta. Le necessità calano con le ore; tutto si calcola da data e ora, senza timer in background.
 */
import type { Expression } from './mascot.ts';

export type Need = 'food' | 'water' | 'joy';
export type PetState = {
  name: string;
  born: number;
  xp: number;
  food: number; water: number; joy: number;
  /** ultimo aggiornamento delle necessità (ms) */
  ts: number;
  streak: number;
  /** ultimo giorno (AAAA-MM-GG) in cui si è presa cura di lei abbastanza */
  streakDay: string;
  /** cosa ha già speso oggi dei gettoni guadagnati */
  spent: { day: string; snack: number; water: number; fit: number; love: number; pet: number };
  /** mostrare Theia agli altri (scelta dell'utente, spenta di base) */
  share: boolean;
};

export const newPet = (now = Date.now(), name = 'Theia'): PetState => ({ name, born: now, xp: 0, food: 70, water: 70, joy: 70, ts: now, streak: 0, streakDay: '', spent: { day: '', snack: 0, water: 0, fit: 0, love: 0, pet: 0 }, share: false });

/** Calo all'ora: dopo circa un giorno senza cure arriva a zero. */
export const DECAY: Record<Need, number> = { food: 3.5, water: 4.5, joy: 2.5 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Le necessità aggiornate all'ora attuale (non cambia lo stato: ritorna una copia). */
export function tick(p: PetState, now = Date.now()): PetState {
  const h = Math.max(0, (now - p.ts) / 3600000);
  if (h <= 0) return p;
  return { ...p, food: clamp(p.food - DECAY.food * h), water: clamp(p.water - DECAY.water * h), joy: clamp(p.joy - DECAY.joy * h), ts: now };
}

/** Gettoni guadagnati OGGI facendo cose vere. I tetti evitano di barare dando 100 volte la stessa cosa. */
export type Earned = { snack: number; water: number; fit: number; love: number };
export function earnedToday(a: { tasksDone: number; mealsLogged: number; waterMl: number; workouts: number; moodLogged: boolean }): Earned {
  return { snack: Math.min(5, a.tasksDone) + Math.min(3, a.mealsLogged), water: Math.min(4, Math.floor(a.waterMl / 500)), fit: Math.min(2, a.workouts), love: a.moodLogged ? 1 : 0 };
}
export type Kind = 'snack' | 'water' | 'fit' | 'love' | 'pet';
/** Coccole gratis, ma poche al giorno. */
export const PET_DAILY = 3;
export const EFFECT: Record<Kind, { need: Need | null; gain: number; xp: number }> = {
  snack: { need: 'food', gain: 25, xp: 5 }, water: { need: 'water', gain: 30, xp: 3 }, fit: { need: 'joy', gain: 20, xp: 10 }, love: { need: 'joy', gain: 15, xp: 2 }, pet: { need: 'joy', gain: 6, xp: 0 },
};

const todaySpent = (p: PetState, day: string) => (p.spent.day === day ? p.spent : { day, snack: 0, water: 0, fit: 0, love: 0, pet: 0 });
export function available(p: PetState, e: Earned, day: string): Record<Kind, number> {
  const s = todaySpent(p, day);
  return { snack: Math.max(0, e.snack - s.snack), water: Math.max(0, e.water - s.water), fit: Math.max(0, e.fit - s.fit), love: Math.max(0, e.love - s.love), pet: Math.max(0, PET_DAILY - s.pet) };
}

/** Dà qualcosa a Theia. Se non c'è il gettone, non fa nulla e lo dice. */
export function give(p0: PetState, kind: Kind, e: Earned, day: string, now = Date.now()): { pet: PetState; ok: boolean; leveledUp: boolean } {
  const p = tick(p0, now);
  if (available(p, e, day)[kind] <= 0) return { pet: p, ok: false, leveledUp: false };
  const fx = EFFECT[kind];
  const s = todaySpent(p, day);
  const next: PetState = { ...p, xp: p.xp + fx.xp, spent: { ...s, [kind]: s[kind] + 1 } };
  if (fx.need) next[fx.need] = clamp(next[fx.need] + fx.gain);
  return { pet: updateStreak(next, day), ok: true, leveledUp: levelOf(next.xp) > levelOf(p.xp) };
}

/** Un giorno conta nella serie se hai dato da mangiare E da bere (o hai fatto un allenamento). */
function updateStreak(p: PetState, day: string): PetState {
  const s = p.spent;
  if (s.day !== day || p.streakDay === day) return p;
  const cared = (s.snack > 0 && s.water > 0) || s.fit > 0;
  if (!cared) return p;
  const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
  return { ...p, streak: p.streakDay === y ? p.streak + 1 : 1, streakDay: day };
}
/** La serie si spezza se ieri non c'è stata cura: si vede, senza punizioni. */
export const streakNow = (p: PetState, day: string): number => { const y = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10); return p.streakDay === day || p.streakDay === y ? p.streak : 0; };

export const levelOf = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1;
export const xpForLevel = (lvl: number) => (lvl - 1) ** 2 * 20;
export const levelProgress = (xp: number) => { const l = levelOf(xp), a = xpForLevel(l), b = xpForLevel(l + 1); return { level: l, pct: Math.round(((xp - a) / (b - a)) * 100), toNext: b - xp }; };

/** Come sta, in parole e in espressione della mascotte. */
export function moodOf(p: PetState, hour = new Date().getHours()): { expr: Expression; label: string; worst: Need | null } {
  const low = (['food', 'water', 'joy'] as Need[]).map((n) => ({ n, v: p[n] })).sort((a, b) => a.v - b.v)[0]!;
  if (low.v < 10) return { expr: 'crying', label: 'Sta male: ha bisogno di te', worst: low.n };
  if (low.v < 30) return { expr: low.n === 'food' ? 'hungry' : low.n === 'water' ? 'sad' : 'bored', label: low.n === 'food' ? 'Ha fame' : low.n === 'water' ? 'Ha sete' : 'Si annoia', worst: low.n };
  if (hour >= 23 || hour < 6) return { expr: 'sleepy', label: 'Ha sonno', worst: null };
  const avg = (p.food + p.water + p.joy) / 3;
  return avg > 80 ? { expr: 'love', label: 'Sta benissimo', worst: null } : avg > 55 ? { expr: 'happy', label: 'Sta bene', worst: null } : { expr: 'neutral', label: 'Va tutto sommato bene', worst: null };
}

/** Quello che gli altri possono vedere, se l'utente lo permette: mai le attività vere, solo livello, serie e umore. */
export type PetPublic = { name: string; level: number; streak: number; expr: Expression; label: string };
export function publicOf(p: PetState, day: string, now = Date.now()): PetPublic {
  const t = tick(p, now);
  const m = moodOf(t, new Date(now).getHours());
  return { name: t.name, level: levelOf(t.xp), streak: streakNow(t, day), expr: m.expr, label: m.label };
}
