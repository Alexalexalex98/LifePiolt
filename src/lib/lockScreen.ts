import { upcoming, type Shift } from './shifts.ts';

/**
 * Cosa mostrare sul blocco schermo e nei widget (modulo PURO). Niente salute, soldi o messaggi: la schermata bloccata la vede chiunque.
 * `hideTitles` tiene solo il tipo e l'ora («Turno alle 14:00») senza i nomi.
 */
export type LockCat = 'turni' | 'impegni' | 'task' | 'acqua' | 'allenamento';
export const LOCK_CATS: { id: LockCat; label: string; note: string }[] = [
  { id: 'turni', label: 'Turni di lavoro', note: 'Il prossimo turno, con il conto alla rovescia; quando è in corso compare anche sul blocco schermo.' },
  { id: 'impegni', label: 'Impegni', note: 'Il prossimo impegno del Plan.' },
  { id: 'task', label: 'Task di oggi', note: 'Quanti task hai da fare oggi e il primo urgente.' },
  { id: 'acqua', label: 'Acqua', note: 'Quanti litri hai bevuto oggi.' },
  { id: 'allenamento', label: 'Allenamento', note: 'L\'allenamento previsto oggi e se l\'hai fatto.' },
];

export type LockItem = {
  kind: LockCat;
  title: string;
  /** riga piccola sotto il titolo */
  sub?: string;
  /** inizio e fine (ms), se hanno un orario */
  startTs?: number;
  endTs?: number;
  color: string;
  /** pagina dell'app da aprire al tocco */
  url: string;
};
export type LockData = { updatedAt: number; items: LockItem[] };

export type LockSources = {
  shifts: Shift[];
  /** impegni per giorno (YYYY-MM-DD) */
  events: Record<string, { time: string; title: string; dur?: number }[]>;
  tasks: { t: string; done?: boolean; urgent?: boolean; due?: string }[];
  waterMl: number;
  waterGoalMl: number;
  workout?: { name: string; done: boolean } | null;
};
export type LockPrefs = { cats: Record<LockCat, boolean>; hideTitles: boolean };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hhmm = (ts: number) => `${String(new Date(ts).getHours()).padStart(2, '0')}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`;
const L = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`;

/** Gli elementi da mostrare in questo momento, in ordine di importanza: prima ciò che ha un orario e arriva presto. */
export function lockItems(src: LockSources, prefs: LockPrefs, now: number): LockItem[] {
  const out: LockItem[] = [];
  const hide = prefs.hideTitles;
  if (prefs.cats.turni) {
    const n = upcoming(src.shifts, now, 14)[0];
    if (n) out.push({ kind: 'turni', title: hide ? 'Turno di lavoro' : n.shift.name, sub: n.startTs <= now ? `In corso, finisce alle ${hhmm(n.endTs)}` : `Inizia alle ${hhmm(n.startTs)}`, startTs: n.startTs, endTs: n.endTs, color: n.shift.color ?? '#8fb3ff', url: 'lifepilot://shifts' });
  }
  if (prefs.cats.impegni) {
    const evs: { ts: number; end: number; title: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const day = new Date(now); day.setDate(day.getDate() + i);
      for (const e of src.events[iso(day)] ?? []) {
        const [h, m] = e.time.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
        const end = ts + (e.dur ?? 60) * 60000;
        if (end > now) evs.push({ ts, end, title: e.title });
      }
    }
    evs.sort((a, b) => a.ts - b.ts);
    const n = evs[0];
    if (n) out.push({ kind: 'impegni', title: hide ? 'Impegno' : n.title, sub: n.ts <= now ? 'In corso' : `Alle ${hhmm(n.ts)}`, startTs: n.ts, endTs: n.end, color: '#c9b6ff', url: 'lifepilot://plan' });
  }
  if (prefs.cats.task) {
    const today = iso(new Date(now));
    const open = src.tasks.filter((x) => !x.done && (x.urgent || (x.due && x.due <= today)));
    if (open.length) {
      const first = open.find((x) => x.urgent) ?? open[0];
      out.push({ kind: 'task', title: `${open.length} ${open.length === 1 ? 'task da fare' : 'task da fare'}`, sub: hide ? undefined : first.t, color: '#ffb020', url: 'lifepilot://lifetask' });
    }
  }
  if (prefs.cats.allenamento && src.workout) out.push({ kind: 'allenamento', title: src.workout.done ? 'Allenamento fatto' : 'Allenamento di oggi', sub: hide || src.workout.done ? undefined : src.workout.name, color: '#ff9d6e', url: 'lifepilot://lifefitness' });
  if (prefs.cats.acqua) out.push({ kind: 'acqua', title: `Acqua ${L(src.waterMl)}`, sub: `su ${L(src.waterGoalMl)}`, color: '#6aa8ff', url: 'lifepilot://fitnessDay' });
  /* ciò che ha un orario e arriva prima viene per primo; il resto segue nell'ordine scelto */
  return out.sort((a, b) => (a.startTs ?? Infinity) - (b.startTs ?? Infinity));
}

/** Più fotografie del blocco schermo nel tempo, così il widget si aggiorna anche con l'app chiusa: ora e ogni volta che un turno o un impegno inizia o finisce. */
export function lockTimeline(src: LockSources, prefs: LockPrefs, now: number): { at: number; data: LockData }[] {
  const marks = new Set<number>([now]);
  for (const o of upcoming(src.shifts, now, 3).slice(0, 4)) { marks.add(Math.max(now, o.startTs)); marks.add(o.endTs); }
  for (let i = 0; i < 2; i++) {
    const day = new Date(now); day.setDate(day.getDate() + i);
    for (const e of src.events[iso(day)] ?? []) {
      const [h, m] = e.time.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
      const ts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
      if (ts > now) { marks.add(ts); marks.add(ts + (e.dur ?? 60) * 60000); }
    }
  }
  return [...marks].filter((t) => t >= now && t < now + 48 * 3600000).sort((a, b) => a - b).slice(0, 12).map((at) => ({ at, data: { updatedAt: now, items: lockItems(src, prefs, at + 1000) } }));
}

/** Il turno in corso adesso (o che inizia entro `soonMin` minuti): serve alla Live Activity sul blocco schermo. */
export function activeShift(shifts: Shift[], now: number, soonMin = 60) {
  const n = upcoming(shifts, now, 2)[0];
  return n && n.startTs - now <= soonMin * 60000 ? n : null;
}
