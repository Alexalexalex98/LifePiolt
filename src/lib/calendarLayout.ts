/**
 * Geometria e raggruppamenti del calendario (mese / settimana / agenda). Modulo PURO, testato in tests/calendarLayout.test.mjs.
 */
export type CalEv = { time: string; title: string; important?: boolean; place?: string; dur?: number; ref?: string; color?: string };
export type Band = { id: string; name: string; start: string; end: string; kind: 'vacation' | 'selection' };

const p2 = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseKey = (k: string) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
export const addDays = (k: string, n: number) => { const d = parseKey(k); d.setDate(d.getDate() + n); return ymd(d); };
/** Numero di giorni tra due chiavi (a e b inclusi se inclusive). */
export function daysBetween(a: string, b: string, inclusive = false): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86400000) + (inclusive ? 1 : 0);
}
export const isKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseKey(s)) === s;
/** Lunedì della settimana che contiene `k`. */
export const weekStart = (k: string) => addDays(k, -((parseKey(k).getDay() + 6) % 7));

/** Minuti dall'inizio del giorno oppure null per orari mancanti ("--:--", "tutto il giorno"). */
export function parseTime(t: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/** Righe di 7 giorni (lunedì-domenica) del mese: null per le celle vuote. */
export function monthGrid(y: number, m: number): (string | null)[][] {
  const days = new Date(y, m + 1, 0).getDate();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${y}-${p2(m + 1)}-${p2(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export type VacLike = { id: string; dest: string; start?: string; end?: string };

/** Fasce da mostrare: vacanze con date + l'intervallo selezionato (se non coincide già con una vacanza). */
export function vacationBands(vacations: VacLike[], range: { start: string; end: string | null; name?: string } | null): Band[] {
  const out: Band[] = [];
  vacations.forEach((v) => { if (isKey(v.start) && isKey(v.end) && v.end >= v.start) out.push({ id: v.id, name: v.dest, start: v.start, end: v.end, kind: 'vacation' }); });
  if (range && isKey(range.start)) {
    const end = range.end && isKey(range.end) ? range.end : range.start;
    if (!out.some((b) => b.start === range.start && b.end === end)) out.push({ id: 'range', name: range.name || 'Vacanza', start: range.start, end, kind: 'selection' });
  }
  return out;
}

export const bandsOnDay = (bands: Band[], k: string) => bands.filter((b) => k >= b.start && k <= b.end);

export type Segment = { band: Band; col0: number; col1: number; lane: number; capL: boolean; capR: boolean };
/** Segmenti delle fasce dentro una riga di 7 giorni (col0..col1 inclusi); `lane` evita sovrapposizioni. */
export function weekSegments(bands: Band[], weekKeys: (string | null)[]): Segment[] {
  const first = weekKeys.find((k) => k) ?? null;
  if (!first) return [];
  const out: Segment[] = [];
  const lanes: number[][] = [];
  const sorted = bands.slice().sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  for (const band of sorted) {
    let c0 = -1, c1 = -1;
    weekKeys.forEach((k, i) => { if (k && k >= band.start && k <= band.end) { if (c0 < 0) c0 = i; c1 = i; } });
    if (c0 < 0) continue;
    let lane = 0;
    while ((lanes[lane] ?? []).some((c) => c >= c0 && c <= c1)) lane++;
    lanes[lane] = [...(lanes[lane] ?? []), ...Array.from({ length: c1 - c0 + 1 }, (_, i) => c0 + i)];
    const k0 = weekKeys[c0]!, k1 = weekKeys[c1]!;
    out.push({ band, col0: c0, col1: c1, lane, capL: k0 === band.start, capR: k1 === band.end });
  }
  return out;
}

/** Impegni del giorno ordinati per ora (senza ora in fondo), con indice originale nello store. */
export function sortedDay(list: CalEv[] | undefined): { e: CalEv; idx: number }[] {
  return (list ?? []).map((e, idx) => ({ e, idx })).sort((a, b) => (parseTime(a.e.time) ?? 1e4) - (parseTime(b.e.time) ?? 1e4) || a.idx - b.idx);
}

/** Per la cella del mese: fino a `max` impegni visibili e il numero di quelli nascosti ("+N"). */
export function daySummary(list: CalEv[] | undefined, max = 3): { shown: { e: CalEv; idx: number }[]; more: number; total: number } {
  const s = sortedDay(list);
  if (s.length <= max) return { shown: s, more: 0, total: s.length };
  return { shown: s.slice(0, max), more: s.length - max, total: s.length };
}

export type Placed = { idx: number; e: CalEv; start: number; end: number; lane: number; lanes: number };
/** Impegni con orario di un giorno: posizione in minuti e colonna (lane) per quelli sovrapposti. */
export function layoutDay(list: CalEv[] | undefined): { placed: Placed[]; allDay: { e: CalEv; idx: number }[] } {
  const timed: Placed[] = [];
  const allDay: { e: CalEv; idx: number }[] = [];
  sortedDay(list).forEach(({ e, idx }) => {
    const s = parseTime(e.time);
    if (s == null) { allDay.push({ e, idx }); return; }
    const dur = Math.max(15, e.dur && e.dur > 0 ? e.dur : 60);
    timed.push({ idx, e, start: s, end: Math.min(24 * 60, s + dur), lane: 0, lanes: 1 });
  });
  // gruppi di sovrapposizione
  let group: Placed[] = [];
  let groupEnd = -1;
  const flush = () => {
    if (!group.length) return;
    const ends: number[] = [];
    group.forEach((p) => {
      let l = ends.findIndex((x) => x <= p.start);
      if (l < 0) { l = ends.length; ends.push(p.end); } else ends[l] = p.end;
      p.lane = l;
    });
    group.forEach((p) => { p.lanes = ends.length; });
    group = []; groupEnd = -1;
  };
  timed.forEach((p) => {
    if (group.length && p.start >= groupEnd) flush();
    group.push(p); groupEnd = Math.max(groupEnd, p.end);
  });
  flush();
  return { placed: timed, allDay };
}

export type AgendaDay = { day: string; items: { e: CalEv; idx: number }[]; bands: Band[] };
/** Elenco cronologico dei prossimi `days` giorni (solo quelli con impegni o fasce). */
export function agenda(events: Record<string, CalEv[]>, bands: Band[], from: string, days = 14): AgendaDay[] {
  const out: AgendaDay[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const items = sortedDay(events[day]);
    const b = bandsOnDay(bands, day);
    if (items.length || b.length) out.push({ day, items, bands: b });
  }
  return out;
}

/** Intervallo di ore visibile nella griglia settimanale (copre orario di lavoro e impegni). */
export function hourRange(week: string[], events: Record<string, CalEv[]>, work: { start: string; end: string }): { from: number; to: number } {
  let from = Math.floor((parseTime(work.start) ?? 540) / 60) - 1;
  let to = Math.ceil((parseTime(work.end) ?? 1080) / 60) + 1;
  week.forEach((k) => (events[k] ?? []).forEach((e) => {
    const s = parseTime(e.time); if (s == null) return;
    from = Math.min(from, Math.floor(s / 60));
    to = Math.max(to, Math.ceil((s + (e.dur || 60)) / 60));
  }));
  return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 6)) };
}
