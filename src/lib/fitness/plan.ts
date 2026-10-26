/** Personal trainer (modulo PURO): sceglie i programmi adatti, organizza la settimana e segue i progressi. */
import { type Goal, type Level, type Place, type Program, type Step } from './data.ts';
import { exById } from './exerciseDb.ts';
import { ALL_PROGRAMS } from './programsExtra.ts';

export type FitProfile = { goal: Goal; level: Level; place: Place; days: number; minutes: number; /** giorni della settimana scelti da te (0 = lunedì … 6 = domenica); se ci sono, valgono al posto di quelli proposti */ weekdays?: number[]; /** bisogni scelti (es. «schiena», «over60», «corsa») */ needs?: string[] };
export type Workout = { id: string; date: string; programId: string; session: number; minutes: number; sets: number; /** messo da solo perché hai spuntato tutti gli esercizi */ auto?: boolean };

const LV: Record<Level, number> = { principiante: 0, intermedio: 1, avanzato: 2 };
const GOAL_NEAR: Record<Goal, Goal[]> = { dimagrire: ['tonificare', 'resistenza'], tonificare: ['dimagrire', 'massa'], massa: ['forza', 'tonificare'], forza: ['massa'], resistenza: ['dimagrire', 'salute'], mobilità: ['salute'], salute: ['mobilità', 'tonificare'] };

/** Punteggio di un programma per una persona: obiettivo, livello, luogo e giorni a settimana. */
export function matchScore(p: Program, f: FitProfile): number {
  let s = 0;
  if (p.goal === f.goal) s += 50; else if (GOAL_NEAR[f.goal].includes(p.goal)) s += 18;
  const dl = Math.abs(LV[p.level] - LV[f.level]);
  s += dl === 0 ? 25 : dl === 1 ? 8 : -20;
  s += p.place === f.place ? 20 : f.place === 'palestra' && p.place === 'casa' ? 6 : -12;
  s += Math.max(0, 30 - Math.abs(p.days - f.days) * 10);
  s += Math.max(0, 10 - Math.round(Math.abs(avgMinutes(p) - f.minutes) / 3));
  const hit = (f.needs ?? []).filter((n) => p.tags?.includes(n)).length;
  s += Math.min(90, hit * 45);
  return s;
}
/** Durata media delle sessioni del programma, in minuti. */
export function avgMinutes(p: Program): number { return Math.round(p.sessions.reduce((a, _s, i) => a + sessionMinutes(p, i), 0) / Math.max(1, p.sessions.length)); }
/** Perché un programma è adatto a te (in parole semplici). */
export function whyThis(p: Program, f: FitProfile): string[] {
  const out: string[] = [];
  const hit = (f.needs ?? []).filter((n) => p.tags?.includes(n));
  if (hit.length) out.push(`Pensato per ciò che hai indicato: ${hit.join(', ')}`);
  if (p.goal === f.goal) out.push(`Punta al tuo obiettivo: ${f.goal}`); else if (GOAL_NEAR[f.goal].includes(p.goal)) out.push(`Obiettivo vicino al tuo (${p.goal})`);
  const dl = Math.abs(LV[p.level] - LV[f.level]);
  out.push(dl === 0 ? `Livello ${p.level}, come il tuo` : dl === 1 ? `Livello ${p.level}: un gradino da te` : `Livello ${p.level}: lontano dal tuo`);
  out.push(p.place === f.place ? `Si fa ${p.place === 'casa' ? 'a casa' : p.place === 'palestra' ? 'in palestra' : 'in piscina'}, dove ti alleni` : `Pensato per ${p.place}`);
  out.push(p.days === f.days ? `${p.days} giorni a settimana, come vuoi tu` : `${p.days} giorni a settimana (tu: ${f.days})`);
  out.push(`Sessioni da circa ${avgMinutes(p)} minuti (tu: ${f.minutes})`);
  return out;
}
export function recommend(f: FitProfile, n = 3, all: Program[] = ALL_PROGRAMS): Program[] {
  return all.map((p, i) => ({ p, i, s: matchScore(p, f) })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n).map((x) => x.p);
}

/** Giorni della settimana (0 = lunedì) in cui allenarsi, distribuiti con almeno un giorno di riposo quando si può. */
export function trainingDays(days: number, custom?: number[]): number[] {
  const mine = [...new Set((custom ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (mine.length) return mine;
  const n = Math.max(1, Math.min(7, Math.round(days)));
  const table: Record<number, number[]> = { 1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
  return table[n];
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Lunedì (0) .. domenica (6) di una data. */
export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7;
export function weekStartOf(d: Date): Date { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - weekdayOf(x)); return x; }

/** Prossima sessione del programma: si va in ordine, dopo l'ultima fatta. */
export function nextSessionIndex(p: Program, history: Workout[]): number {
  const last = [...history].filter((w) => w.programId === p.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return last ? (last.session + 1) % p.sessions.length : 0;
}
export type Day = { date: string; weekday: number; planned: boolean; done: boolean; session?: number };
/** La settimana del programma: giorni previsti, già fatti, e quale sessione tocca. */
export function weekView(p: Program, f: Pick<FitProfile, 'days' | 'weekdays'>, history: Workout[], now: Date): Day[] {
  const start = weekStartOf(now);
  const plan = trainingDays(Math.min(f.days, 7), f.weekdays);
  const doneDates = new Set(history.filter((w) => w.programId === p.id).map((w) => w.date));
  let k = nextSessionIndex(p, history.filter((w) => w.date < iso(start)));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const date = iso(d), planned = plan.includes(i);
    const out: Day = { date, weekday: i, planned, done: doneDates.has(date) };
    if (planned) { out.session = k % p.sessions.length; k++; }
    return out;
  });
}
export const stepMinutes = (s: { sets: number; reps?: number; secs?: number; rest: number }): number => {
  const work = s.secs ? s.sets * s.secs : s.sets * (s.reps ?? 10) * 3;
  return (work + Math.max(0, s.sets - 1) * s.rest) / 60;
};
/** I passi di una sessione: quelli modificati da te, se ci sono, altrimenti quelli del programma. */
export const stepsOf = (p: Program, idx: number, edits?: Record<string, Step[]>): Step[] => edits?.[`${p.id}:${idx}`] ?? p.sessions[idx].steps;
export const editKey = (p: Program, idx: number) => `${p.id}:${idx}`;
export function sessionMinutes(p: Program, idx: number, edits?: Record<string, Step[]>): number { return Math.max(5, Math.round(stepsOf(p, idx, edits).reduce((a, s) => a + stepMinutes(s), 0) + 4)); }
export function equipmentOf(p: Program): string[] { return [...new Set(p.sessions.flatMap((s) => s.steps.map((x) => exById(x.ex)?.equip ?? 'nessuno')))].filter((e) => e !== 'nessuno'); }
/** Un passo nuovo per un esercizio: serie e ripetizioni (o secondi) ragionevoli. */
export const newStep = (ex: { id: string; timed?: boolean }): Step => (ex.timed ? { ex: ex.id, sets: 3, secs: 30, rest: 45 } : { ex: ex.id, sets: 3, reps: 10, rest: 60 });

export type Stats = { week: number; month: number; minutesWeek: number; streakDays: number; total: number };
export function stats(history: Workout[], now: Date): Stats {
  const today = iso(now);
  const days = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return iso(d); };
  const inRange = (from: string) => history.filter((w) => w.date >= from && w.date <= today);
  const dates = new Set(history.map((w) => w.date));
  let streak = 0; const c = new Date(now); if (!dates.has(iso(c))) c.setDate(c.getDate() - 1);
  while (dates.has(iso(c))) { streak++; c.setDate(c.getDate() - 1); }
  return { week: inRange(iso(weekStartOf(now))).length, month: inRange(days(29)).length, minutesWeek: inRange(iso(weekStartOf(now))).reduce((a, w) => a + w.minutes, 0), streakDays: streak, total: history.length };
}
