/** Intuizioni calcolate sul telefono dai tuoi dati (nessuna AI). Ogni funzione è pura e spiega il perché. */
export type Pt = { d: string; v: number };
export type DayEv = { day: string; time: string; title: string };

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const addDay = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/** Dopo le riunioni/impegni serali (dalle 18:00) dormi meno? Serve almeno 4 sere con e 4 senza. Il sonno è in ore. */
export function lateEventSleep(events: DayEv[], sleep: Pt[], from = '18:00'): { diffMin: number; nWith: number; nWithout: number } | null {
  const late = new Set(events.filter((e) => e.time >= from).map((e) => e.day));
  const byDay = new Map(sleep.map((p) => [p.d, p.v]));
  const withL: number[] = [], without: number[] = [];
  byDay.forEach((v, d) => { const prev = addDay(d, -1); (late.has(prev) ? withL : without).push(v); });
  if (withL.length < 4 || without.length < 4) return null;
  const diff = (mean(withL) - mean(without)) * 60;
  return Math.abs(diff) >= 20 ? { diffMin: Math.round(diff), nWith: withL.length, nWithout: without.length } : null;
}

/** Il giorno ha molti impegni? (soglia 5) */
export function busyDay(events: DayEv[], day: string, threshold = 5): number | null {
  const n = events.filter((e) => e.day === day).length;
  return n >= threshold ? n : null;
}
