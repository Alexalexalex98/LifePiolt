/**
 * Orario di lavoro e fasce libere (modulo PURO, senza import dell'app).
 * Un orario è un oggetto { "1": [["09:00","12:30"],["14:00","18:00"]], ... } con la chiave = giorno della settimana (0 = domenica).
 */
export type Span = [string, string];
export type Schedule = Record<string, Span[]>;
export type Range = [number, number]; // minuti dalla mezzanotte: [inizio, fine)

export const DEFAULT_SCHEDULE: Schedule = {
  '0': [], '6': [],
  '1': [['09:00', '12:30'], ['14:00', '18:00']], '2': [['09:00', '12:30'], ['14:00', '18:00']], '3': [['09:00', '12:30'], ['14:00', '18:00']],
  '4': [['09:00', '12:30'], ['14:00', '18:00']], '5': [['09:00', '12:30'], ['14:00', '18:00']],
};

export const toMin = (t: string): number => { const [h, m] = t.split(':'); return (parseInt(h ?? '0', 10) || 0) * 60 + (parseInt(m ?? '0', 10) || 0); };
export const fromMin = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const weekdayOf = (day: string): number => new Date(day + 'T12:00:00').getDay();

/** Le fasce di lavoro di un giorno (YYYY-MM-DD), ordinate e senza fasce vuote o rovesciate. */
export function daySpans(s: Schedule, day: string): Range[] {
  return (s[String(weekdayOf(day))] ?? []).map(([a, b]): Range => [toMin(a), toMin(b)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
}

/** Unisce intervalli che si toccano o si sovrappongono. */
export function mergeRanges(r: Range[]): Range[] {
  const out: Range[] = [];
  for (const x of [...r].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]); else out.push([x[0], x[1]]);
  }
  return out;
}

/** Sottrae gli intervalli occupati dalle fasce date. */
export function subtract(base: Range[], busy: Range[]): Range[] {
  let cur = mergeRanges(base);
  for (const [bs, be] of mergeRanges(busy)) {
    const next: Range[] = [];
    for (const [s, e] of cur) {
      if (be <= s || bs >= e) { next.push([s, e]); continue; }
      if (bs > s) next.push([s, bs]);
      if (be < e) next.push([be, e]);
    }
    cur = next;
  }
  return cur;
}

export const evRange = (e: { time: string; dur?: number }): Range => { const s = toMin(e.time); return [s, s + (e.dur ?? 60)]; };

/** Fasce libere di un giorno dentro l'orario di lavoro, lunghe almeno minDur minuti. */
export function freeSlots(s: Schedule, day: string, busy: Range[], minDur = 15): Range[] {
  return subtract(daySpans(s, day), busy).filter(([a, b]) => b - a >= minDur);
}

/** L'impegno sta tutto dentro una fascia di lavoro? */
export function fitsInHours(s: Schedule, day: string, time: string, dur: number): boolean {
  const a = toMin(time), b = a + dur;
  return daySpans(s, day).some(([x, y]) => a >= x && b <= y);
}

export const addDays = (day: string, n: number): string => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Primo posto libero dentro l'orario di lavoro, a partire da un giorno e da un'ora.
 * busyOf(day) = gli intervalli già occupati quel giorno (impegni di lavoro, assenze…).
 */
export function nextFree(s: Schedule, fromDay: string, fromMinute: number, dur: number, busyOf: (day: string) => Range[], maxDays = 21): { day: string; time: string } | null {
  for (let i = 0; i < maxDays; i++) {
    const day = addDays(fromDay, i);
    const free = freeSlots(s, day, busyOf(day), dur);
    for (const [a, b] of free) {
      const start = Math.max(a, i === 0 ? fromMinute : 0);
      if (b - start >= dur) return { day, time: fromMin(start) };
    }
  }
  return null;
}

/** Fasce libere in comune a più persone (ognuna con il suo orario e i suoi impegni). */
export function commonFree(people: { schedule: Schedule; busy: Range[] }[], day: string, dur: number): Range[] {
  if (!people.length) return [];
  let cur = freeSlots(people[0]!.schedule, day, people[0]!.busy, dur);
  for (const p of people.slice(1)) {
    const f = freeSlots(p.schedule, day, p.busy, dur);
    const next: Range[] = [];
    for (const [a, b] of cur) for (const [c, d] of f) { const s = Math.max(a, c), e = Math.min(b, d); if (e - s >= dur) next.push([s, e]); }
    cur = next;
  }
  return cur;
}

/** Task di lavoro da distribuire (durata in minuti, scadenza opzionale, priorità più alta = prima). */
export type WorkTask = { id: string; dur: number; due?: string; urgent?: boolean };
/** Mette i task nelle fasce libere: prima urgenti e con scadenza vicina, mai fuori orario. */
export function planTasks(s: Schedule, tasks: WorkTask[], fromDay: string, fromMinute: number, busyOf: (day: string) => Range[]): { id: string; day: string; time: string; dur: number }[] {
  const extra = new Map<string, Range[]>();
  const busy = (day: string) => [...busyOf(day), ...(extra.get(day) ?? [])];
  const order = [...tasks].sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const out: { id: string; day: string; time: string; dur: number }[] = [];
  for (const t of order) {
    const at = nextFree(s, fromDay, fromMinute, t.dur, busy);
    if (!at) continue;
    if (t.due && at.day > t.due) continue; // non entra prima della scadenza: lo segnala il chiamante
    const m = toMin(at.time);
    extra.set(at.day, [...(extra.get(at.day) ?? []), [m, m + t.dur]]);
    out.push({ id: t.id, day: at.day, time: at.time, dur: t.dur });
  }
  return out;
}

/** Testo leggibile di un giorno: "09:00–12:30, 14:00–18:00" oppure "Libero". */
export function describeDay(s: Schedule, weekday: number): string {
  const a = s[String(weekday)] ?? [];
  return a.length ? a.map(([x, y]) => `${x}–${y}`).join(', ') : '';
}

/** "09:00-12:30, 14:00-18:00" -> fasce. Vuoto = giorno libero. Se qualcosa non torna restituisce null. */
export function parseSpans(text: string): Span[] | null {
  const t = text.trim();
  if (!t || /^(libero|riposo|-)$/i.test(t)) return [];
  const out: Span[] = [];
  for (const part of t.split(/[,;]+/)) {
    const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*[-–a]\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(part);
    if (!m) return null;
    const a = parseInt(m[1]!, 10) * 60 + parseInt(m[2] ?? '0', 10), b = parseInt(m[3]!, 10) * 60 + parseInt(m[4] ?? '0', 10);
    if (a >= b || b > 1440 || a < 0) return null;
    out.push([fromMin(a), fromMin(b)]);
  }
  out.sort((x, y) => toMin(x[0]) - toMin(y[0]));
  for (let i = 1; i < out.length; i++) if (toMin(out[i]![0]) < toMin(out[i - 1]![1])) return null;
  return out;
}
export const formatSpans = (a: Span[] | undefined): string => (a ?? []).map(([x, y]) => `${x}-${y}`).join(', ');
