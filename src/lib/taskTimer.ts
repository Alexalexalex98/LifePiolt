/** Timer di un task (modulo puro): parte, va in pausa, riprende; il tempo totale è la somma dei tratti. */
export type TaskTimer = { /** ms accumulati nei tratti già chiusi */ acc: number; /** inizio del tratto in corso, se sta andando */ since?: number };

export const startTimer = (t: TaskTimer | undefined, now: number): TaskTimer => (t?.since ? t : { acc: t?.acc ?? 0, since: now });
export const pauseTimer = (t: TaskTimer | undefined, now: number): TaskTimer => ({ acc: elapsedMs(t, now) });
export const elapsedMs = (t: TaskTimer | undefined, now: number): number => (t ? t.acc + (t.since ? Math.max(0, now - t.since) : 0) : 0);
export const isRunning = (t: TaskTimer | undefined): boolean => !!t?.since;
export function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
}
/** Primi `max` task da fare, nell'ordine: prima urgenti, poi con scadenza vicina, poi il resto nell'ordine della lista. */
export function firstOpen<T extends { done?: boolean; urgent?: boolean; due?: string }>(tasks: T[], isDone: (t: T) => boolean, max = 3): T[] {
  return tasks.map((t, i) => ({ t, i })).filter((x) => !isDone(x.t))
    .sort((a, b) => (Number(!!b.t.urgent) - Number(!!a.t.urgent)) || ((a.t.due ?? '9999') < (b.t.due ?? '9999') ? -1 : (a.t.due ?? '9999') > (b.t.due ?? '9999') ? 1 : 0) || a.i - b.i)
    .slice(0, max).map((x) => x.t);
}
