import { useMemo } from 'react';

import { collect } from '@/lib/analyticsData';
import { addDays, todayStr } from '@/lib/analytics';
import { analyseMood, type DayCtx, type MoodReport } from '@/lib/moodAnalysis';
import { useContext } from '@/store/context';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';

/** Un record per ogni giorno con un check-in dell'umore, arricchito con tutto il resto della vita. */
export function buildMoodDays(): DayCtx[] {
  const today = todayStr();
  const series = collect(today);
  const map = (id: string) => new Map((series.find((s) => s.def.id === id)?.pts ?? []).map((p) => [p.d, p.v]));
  const mood = map('mood'), sleep = map('sleep'), steps = map('steps'), stress = map('stress'), exercise = map('exercise'), mindful = map('mindful'), spend = map('dailyspend');
  const wx = useContext.getState().days;
  const ev = useLife.getState().events;
  return [...mood.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, m]) => ({
    day, mood: m, weekday: new Date(day + 'T00:00:00').getDay(),
    rain: wx[day]?.rain, tmax: wx[day]?.tmax, sun: wx[day]?.sun,
    events: ev[day] ? ev[day].length : (day <= today ? 0 : undefined),
    sleep: sleep.get(day), steps: steps.get(day), stress: stress.get(day), exercise: exercise.get(day), mindful: mindful.get(day), spend: spend.get(day),
  }));
}

export function useMoodData(): { days: DayCtx[]; report: MoodReport } {
  const moods = useHealth((s) => s.moods), hs = useHealth((s) => s.series);
  const wx = useContext((s) => s.days);
  const events = useLife((s) => s.events);
  const months = useFin((s) => s.months);
  return useMemo(() => { const days = buildMoodDays(); return { days, report: analyseMood(days) }; }, [moods, hs, wx, events, months]);
}

export const lastNDays = (n: number) => Array.from({ length: n }, (_, i) => addDays(todayStr(), -(n - 1 - i)));
