/** Orari di una giornata per scegliere quando fissare una riunione (modulo PURO, nessun alias '@/').
 *  free = libero per tutti · mine = c'è un TUO impegno (lo puoi spostare) · busy = occupato (un invitato, o tutto il giorno): non selezionabile. */
export type Range = [number, number];
export type SlotState = 'free' | 'mine' | 'busy';
export type Slot = { time: string; state: SlotState; mine: number[]; who: string[] };
type Ev = { time: string; dur?: number };
const toMin = (t: string): number => { const [h, m] = t.split(':'); return (parseInt(h ?? '0', 10) || 0) * 60 + (parseInt(m ?? '0', 10) || 0); };
const fromMin = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const hit = (a: Range, b: Range) => a[0] < b[1] && b[0] < a[1];
const timed = (e: Ev) => /^\d{1,2}:\d{2}$/.test(e.time);

/** `mine`: i tuoi impegni del giorno (l'indice conta). `theirs`: gli occupati degli invitati, per persona. */
export function buildSlots(mine: Ev[], theirs: { id: string; ranges: Range[] }[], dur: number, win: Range = [7 * 60, 21 * 60], step = 30): Slot[] {
  const out: Slot[] = [];
  for (let s = Math.ceil(win[0] / step) * step; s + dur <= win[1]; s += step) {
    const r: Range = [s, s + dur];
    const who = theirs.filter((t) => t.ranges.some((x) => hit(x, r))).map((t) => t.id);
    const allDay = mine.some((e) => timed(e) && (e.dur ?? 60) >= 1440);
    const idx = mine.map((e, i) => ({ e, i })).filter(({ e }) => timed(e) && (e.dur ?? 60) < 1440 && hit([toMin(e.time), toMin(e.time) + (e.dur ?? 60)], r)).map(({ i }) => i);
    out.push({ time: fromMin(s), state: who.length || allDay ? 'busy' : idx.length ? 'mine' : 'free', mine: idx, who });
  }
  return out;
}
/** Orari liberi dove spostare un tuo impegno lungo `dur`, evitando il tuo altro impegno e la nuova riunione. */
export function moveTargets(mine: Ev[], skip: number, extra: Range[], dur: number, win: Range = [7 * 60, 21 * 60], step = 30): string[] {
  const busy: Range[] = [...mine.filter((e, i) => i !== skip && timed(e) && (e.dur ?? 60) < 1440).map((e): Range => [toMin(e.time), toMin(e.time) + (e.dur ?? 60)]), ...extra];
  const out: string[] = [];
  for (let s = Math.ceil(win[0] / step) * step; s + dur <= win[1]; s += step) if (!busy.some((b) => hit([s, s + dur], b))) out.push(fromMin(s));
  return out;
}
