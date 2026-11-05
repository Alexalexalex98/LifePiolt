/** Sovrapposizioni tra impegni (modulo PURO, nessun alias '@/'): chi è occupato quando, e dove spostare. */
export type Span = { time: string; dur?: number; title: string };
export type Range = [number, number];
const toMin = (t: string): number => { const [h, m] = t.split(':'); return (parseInt(h ?? '0', 10) || 0) * 60 + (parseInt(m ?? '0', 10) || 0); };
export const fromMin = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const rangeOf = (e: { time: string; dur?: number }): Range => { const s = toMin(e.time); return [s, s + (e.dur ?? 60)]; };
export const overlaps = (a: Range, b: Range): boolean => a[0] < b[1] && b[0] < a[1];
const timed = (e: { time: string }) => /^\d{1,2}:\d{2}$/.test(e.time);

/** Gli impegni (con la loro posizione nella lista del giorno) che si sovrappongono a [time, time+dur). Gli impegni «tutto il giorno» o senza ora non contano. */
export function conflictsWith<T extends Span>(list: T[], time: string, dur: number, ignore?: (e: T, i: number) => boolean): { e: T; idx: number }[] {
  const r: Range = [toMin(time), toMin(time) + dur];
  return list.map((e, idx) => ({ e, idx })).filter(({ e, idx }) => timed(e) && (e.dur ?? 60) < 1440 && !(ignore?.(e, idx)) && overlaps(rangeOf(e), r));
}

/** Orari liberi di inizio (ogni `step` minuti, dentro la finestra) in cui entra un impegno lungo `dur` senza toccare gli occupati. */
export function freeStarts(busy: Range[], dur: number, win: Range = [8 * 60, 19 * 60], step = 30): string[] {
  const out: string[] = [];
  for (let s = Math.ceil(win[0] / step) * step; s + dur <= win[1]; s += step) if (!busy.some((b) => overlaps([s, s + dur], b))) out.push(fromMin(s));
  return out;
}
/** Gli intervalli occupati di più persone insieme. */
export const unionBusy = (lists: Range[][]): Range[] => lists.flat();

/** Un impegno in arrivo (di lavoro) contro i miei: quelli con cui si scontra. Esclude se stesso. */
export function incomingConflicts<T extends Span & { wid?: string }>(mine: T[], incoming: { time: string; dur?: number; wid?: string }): { e: T; idx: number }[] {
  return conflictsWith(mine, incoming.time, incoming.dur ?? 60, (e) => !!incoming.wid && e.wid === incoming.wid);
}
