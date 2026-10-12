/**
 * Sessione di concentrazione (modulo puro): la persona imposta SOLO il tempo totale di lavoro.
 * Si lavora a blocchi da 25 minuti con 5 minuti di pausa; dopo ogni 125 minuti di lavoro la pausa è di 15 minuti.
 * Nessuna pausa dopo l'ultimo blocco.
 */
export const WORK_MIN = 25, SHORT_BREAK_MIN = 5, LONG_BREAK_MIN = 15, LONG_EVERY_MIN = 125;
export const MIN_TOTAL = 5, MAX_TOTAL = 480;

export type Segment = { kind: 'work' | 'break'; min: number; long?: boolean };
export const clampTotal = (m: number): number => Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, Math.round(Number.isFinite(m) ? m : WORK_MIN)));

export function focusPlan(totalMin: number): Segment[] {
  let left = clampTotal(totalMin), worked = 0;
  const out: Segment[] = [];
  while (left > 0) {
    const w = Math.min(WORK_MIN, left);
    out.push({ kind: 'work', min: w });
    left -= w; worked += w;
    if (left > 0) { const long = worked % LONG_EVERY_MIN === 0; out.push({ kind: 'break', min: long ? LONG_BREAK_MIN : SHORT_BREAK_MIN, long }); }
  }
  return out;
}
/** Durata complessiva (lavoro + pause) in minuti. */
export const planMinutes = (plan: Segment[]): number => plan.reduce((n, s) => n + s.min, 0);

export type FocusPos = { index: number; kind: 'work' | 'break'; long: boolean; /** ms rimasti nel segmento in corso */ remainingMs: number; segMs: number; workMinDone: number; workBlock: number; workBlocks: number; done: boolean };
/** Dove si è arrivati dopo `elapsedMs` di sessione (pause incluse). */
export function focusAt(plan: Segment[], elapsedMs: number): FocusPos {
  const blocks = plan.filter((s) => s.kind === 'work').length;
  let t = Math.max(0, elapsedMs), workDone = 0, blk = 0;
  for (let i = 0; i < plan.length; i++) {
    const s = plan[i], ms = s.min * 60000;
    if (s.kind === 'work') blk++;
    if (t < ms) return { index: i, kind: s.kind, long: !!s.long, remainingMs: ms - t, segMs: ms, workMinDone: Math.floor(workDone + (s.kind === 'work' ? t / 60000 : 0)), workBlock: blk, workBlocks: blocks, done: false };
    t -= ms; if (s.kind === 'work') workDone += s.min;
  }
  const last = plan[plan.length - 1];
  return { index: plan.length - 1, kind: last?.kind ?? 'work', long: false, remainingMs: 0, segMs: (last?.min ?? 0) * 60000, workMinDone: workDone, workBlock: blocks, workBlocks: blocks, done: true };
}
/** Riassunto leggibile del piano, es. «4 blocchi da 25 min, 3 pause da 5 min». */
export function planSummary(plan: Segment[]): string {
  const w = plan.filter((s) => s.kind === 'work'), short = plan.filter((s) => s.kind === 'break' && !s.long), long = plan.filter((s) => s.long);
  const parts = [`${w.length} ${w.length === 1 ? 'blocco' : 'blocchi'} di lavoro`];
  if (short.length) parts.push(`${short.length} ${short.length === 1 ? 'pausa' : 'pause'} da ${SHORT_BREAK_MIN} min`);
  if (long.length) parts.push(`${long.length} ${long.length === 1 ? 'pausa lunga' : 'pause lunghe'} da ${LONG_BREAK_MIN} min`);
  return parts.join(' · ');
}
