/** Prossimo impegno per la Home (logica pura, testabile). */
export type HomeEvent = { time: string; title: string; place?: string; important?: boolean };

const pad2 = (n: number) => String(n).padStart(2, '0');
export const homeDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export type NextEvent = { day: string; ev: HomeEvent; daysAhead: number; minutesAway: number | null; todayLeft: number };

/** Il primo impegno non ancora iniziato da adesso in poi (oggi, poi i giorni successivi fino all'orizzonte). */
export function nextEvent(events: Record<string, HomeEvent[]>, now: Date, horizonDays = 45): NextEvent | null {
  const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0); };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = (events[homeDayKey(now)] ?? []).filter((e) => mins(e.time) >= nowMin);
  for (let i = 0; i <= horizonDays; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = homeDayKey(d);
    const list = (events[key] ?? []).filter((e) => i > 0 || mins(e.time) >= nowMin).slice().sort((a, b) => mins(a.time) - mins(b.time));
    if (list.length) return { day: key, ev: list[0], daysAhead: i, minutesAway: i === 0 ? mins(list[0].time) - nowMin : null, todayLeft: today.length };
  }
  return null;
}
