import { create } from 'zustand';

import { dayKey, uid, weekdayShortDate } from '@/lib/format';
import { replaceTodayMood } from '@/lib/moodLog';
import { persisted } from './persist';

export type Metric = 'sleep' | 'hr' | 'steps' | 'weight' | 'stress' | 'hrv' | 'mindful' | 'energy' | 'exercise' | 'vo2' | 'spo2';
export type Source = 'manuale' | 'apple' | 'demo' | 'stimato';
export type Workout = { id: string; type: string; date: string; duration: number; calories: number; source?: Source };
export type MindSession = { id: string; type: string; date: string; duration: number };
export type MoodEntry = { date: string; mood: string; day?: string };
export type Pt = { d: string; v: number };

export const healthMeta: Record<Metric, { label: string; unit: string; color: string; dec: number }> = {
  sleep: { label: 'Sonno', unit: 'h', color: '#7be0b0', dec: 1 },
  hr: { label: 'Frequenza a riposo', unit: 'bpm', color: '#ff9d9d', dec: 0 },
  steps: { label: 'Passi', unit: '', color: '#7bb8e0', dec: 0 },
  weight: { label: 'Peso', unit: 'kg', color: '#e0c97b', dec: 1 },
  stress: { label: 'Stress', unit: '/100', color: '#ffb84f', dec: 0 },
  hrv: { label: 'HRV', unit: 'ms', color: '#b96bff', dec: 0 },
  mindful: { label: 'Mindfulness', unit: 'min', color: '#4fc7e0', dec: 0 },
  energy: { label: 'Energia attiva', unit: 'kcal', color: '#ff8a5b', dec: 0 },
  exercise: { label: 'Minuti di esercizio', unit: 'min', color: '#6ec9dd', dec: 0 },
  vo2: { label: 'VO₂ max', unit: 'ml/kg/min', color: '#8fa4ff', dec: 1 },
  spo2: { label: 'Ossigeno nel sangue', unit: '%', color: '#9be0e0', dec: 0 },
};
export const allMetrics = Object.keys(healthMeta) as Metric[];

export const moodOptions: [string, string][] = [['Felice', '#7be0b0'], ['Calmo', '#7bb8e0'], ['Neutro', '#8e98a8'], ['Stressato', '#e0c97b'], ['Triste', '#7c93c9'], ['Arrabbiato', '#ff9d9d']];

type Series = Record<Metric, number[]>;
type Dates = Record<Metric, string[]>;
type Sources = Partial<Record<Metric, Source>>;

type HealthState = {
  series: Series;
  dates: Dates;
  sources: Sources;
  lastLog: Partial<Record<Metric, string>>;
  workouts: Workout[];
  mindSessions: MindSession[];
  moods: MoodEntry[];
  wearable: { connected: boolean; device: string | null };
  lastSync: number | null;
  syncError: string | null;

  logMetric: (m: Metric, v: number) => void;
  setPoints: (m: Metric, pts: Pt[], source: Source) => void;
  mergeWorkouts: (w: Workout[]) => void;
  addWorkout: (type: string, duration: number) => void;
  delWorkout: (id: string) => void;
  addMind: (type: string, duration: number) => void;
  delMind: (id: string) => void;
  logMood: (mood: string) => void;
  /** Sostituisce l'umore di oggi (o lo rimuove con null) senza aggiungerne un secondo. */
  setTodayMood: (mood: string | null) => void;
  connect: (device: string | null) => void;
  setSync: (ts: number | null, err: string | null) => void;
  reset: () => void;
};

const empty = <T,>(f: () => T): Record<Metric, T> => Object.fromEntries(allMetrics.map((m) => [m, f()])) as Record<Metric, T>;
const emptySeries = (): Series => empty<number[]>(() => []);
const emptyDates = (): Dates => empty<string[]>(() => []);

export const useHealth = create<HealthState>()(
  persisted<HealthState>('health', (set) => ({
    series: emptySeries(),
    dates: emptyDates(),
    sources: {},
    lastLog: {},
    workouts: [],
    mindSessions: [],
    moods: [],
    wearable: { connected: false, device: null },
    lastSync: null,
    syncError: null,

    logMetric: (m, v) =>
      set((s) => {
        const today = dayKey();
        const series = { ...emptySeries(), ...s.series };
        const dates = { ...emptyDates(), ...(s.dates ?? {}) };
        const arr = (series[m] ?? []).slice();
        const ds = ensureDates(arr, dates[m], s.lastLog[m]);
        if (ds.length && ds[ds.length - 1] === today) arr[arr.length - 1] = v;
        else { arr.push(v); ds.push(today); }
        return { series: { ...series, [m]: arr.slice(-120) }, dates: { ...dates, [m]: ds.slice(-120) }, sources: { ...s.sources, [m]: s.sources[m] === 'apple' ? 'apple' : 'manuale' }, lastLog: { ...s.lastLog, [m]: today } };
      }),

    /** Unisce punti datati (es. da Apple Health): lo stesso giorno viene sovrascritto. */
    setPoints: (m, pts, source) =>
      set((s) => {
        const series = { ...emptySeries(), ...s.series };
        const dates = { ...emptyDates(), ...(s.dates ?? {}) };
        const cur = ensureDates(series[m] ?? [], dates[m], s.lastLog[m]);
        const map = new Map<string, number>();
        (series[m] ?? []).forEach((v, i) => map.set(cur[i], v));
        pts.forEach((p) => { if (Number.isFinite(p.v)) map.set(p.d, p.v); });
        const days = [...map.keys()].sort().slice(-120);
        return { series: { ...series, [m]: days.map((d) => map.get(d)!) }, dates: { ...dates, [m]: days }, sources: { ...s.sources, [m]: source } };
      }),

    mergeWorkouts: (w) =>
      set((s) => {
        const ids = new Set(s.workouts.map((x) => x.id));
        return { workouts: [...w.filter((x) => !ids.has(x.id)), ...s.workouts].slice(0, 200) };
      }),
    addWorkout: (type, duration) => set((s) => ({ workouts: [{ id: uid(), type, date: weekdayShortDate(), duration, calories: Math.round(duration * 7), source: 'manuale' }, ...s.workouts] })),
    delWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
    addMind: (type, duration) => set((s) => ({ mindSessions: [{ id: uid(), type, date: weekdayShortDate(), duration }, ...s.mindSessions] })),
    delMind: (id) => set((s) => ({ mindSessions: s.mindSessions.filter((x) => x.id !== id) })),
    logMood: (mood) => set((s) => ({ moods: replaceTodayMood(s.moods, mood, dayKey(), weekdayShortDate()) })),
    setTodayMood: (mood) => set((s) => ({ moods: replaceTodayMood(s.moods, mood, dayKey(), weekdayShortDate()) })),
    connect: (device) => set({ wearable: { connected: !!device, device } }),
    setSync: (lastSync, syncError) => set({ lastSync, syncError }),
    reset: () => set({ series: emptySeries(), dates: emptyDates(), sources: {}, lastLog: {}, workouts: [], mindSessions: [], moods: [], wearable: { connected: false, device: null }, lastSync: null, syncError: null }),
  })),
);

/** Se mancano le date (dati vecchi o demo), si assume un valore al giorno che termina oggi. */
export function ensureDates(values: number[], dates: string[] | undefined, lastLog?: string): string[] {
  if (dates && dates.length === values.length) return dates.slice();
  const end = lastLog ? new Date(lastLog + 'T00:00:00') : new Date();
  return values.map((_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - (values.length - 1 - i));
    return dayKey(d);
  });
}

export function pointsOf(s: Pick<HealthState, 'series' | 'dates' | 'lastLog'>, m: Metric): Pt[] {
  const v = s.series?.[m] ?? [];
  const d = ensureDates(v, s.dates?.[m], s.lastLog?.[m]);
  return v.map((x, i) => ({ d: d[i], v: x }));
}

export const last = (a: number[] | undefined) => (a && a.length ? a[a.length - 1] : null);

export function streakOf(arr: number[], pred: (v: number) => boolean): number {
  let s = 0;
  for (let i = arr.length - 1; i >= 0; i--) { if (pred(arr[i])) s++; else break; }
  return s;
}
