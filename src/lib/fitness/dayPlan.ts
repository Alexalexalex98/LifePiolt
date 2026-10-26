/** Cosa c'è in ogni giorno (modulo PURO): allenamenti passati, previsti o scelti da te, per qualunque data. */
import type { Program } from './data.ts';
import { nextSessionIndex, trainingDays, weekStartOf, weekdayOf, type Workout } from './plan.ts';

export type Override = { programId: string; session: number } | { rest: true };
export type DayInfo = { date: string; planned: boolean; programId: string | null; session: number | null; source: 'storico' | 'scelta' | 'piano' | 'libero'; done: boolean };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIso = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function addDays(date: string, n: number): string { const d = parseIso(date); d.setDate(d.getDate() + n); return iso(d); }
const mod = (a: number, n: number) => ((a % n) + n) % n;

export type DayCtx = { program: Program | null; profile: { days: number; weekdays?: number[] } | null; history: Workout[]; plans: Record<string, Override>; now: Date };

/** Il giorno `date`: se ti sei allenato, cosa hai fatto; se l'hai scelto tu, la tua scelta; altrimenti il programma. */
export function dayInfo(date: string, c: DayCtx): DayInfo {
  const hist = [...c.history].filter((w) => w.date === date).pop();
  if (hist) return { date, planned: true, programId: hist.programId, session: hist.session, source: 'storico', done: true };
  const o = c.plans[date];
  if (o) return 'rest' in o ? { date, planned: false, programId: null, session: null, source: 'scelta', done: false } : { date, planned: true, programId: o.programId, session: o.session, source: 'scelta', done: false };
  if (!c.program || !c.profile) return { date, planned: false, programId: null, session: null, source: 'libero', done: false };
  const plan = trainingDays(Math.min(c.profile.days, 7), c.profile.weekdays);
  const j = plan.indexOf(weekdayOf(parseIso(date)));
  if (j < 0) return { date, planned: false, programId: null, session: null, source: 'libero', done: false };
  const w = Math.round((weekStartOf(parseIso(date)).getTime() - weekStartOf(c.now).getTime()) / (7 * 86400000));
  const k0 = nextSessionIndex(c.program, c.history.filter((x) => x.date < iso(weekStartOf(c.now))));
  return { date, planned: true, programId: c.program.id, session: mod(k0 + w * plan.length + j, c.program.sessions.length), source: 'piano', done: false };
}
