import { create } from 'zustand';

import { dayKey, uid, weekdayShortDate } from '@/lib/format';
import { persisted } from './persist';

export type Metric = 'sleep' | 'hr' | 'steps' | 'weight' | 'stress' | 'hrv' | 'mindful';
export type Workout = { id: string; type: string; date: string; duration: number; calories: number };
export type MindSession = { id: string; type: string; date: string; duration: number };
export type MoodEntry = { date: string; mood: string };

export const healthMeta: Record<Metric, { label: string; unit: string; color: string; dec: number }> = {
  sleep: { label: 'Sonno', unit: 'h', color: '#7be0b0', dec: 1 },
  hr: { label: 'Frequenza a riposo', unit: 'bpm', color: '#ff9d9d', dec: 0 },
  steps: { label: 'Passi', unit: '', color: '#7bb8e0', dec: 0 },
  weight: { label: 'Peso', unit: 'kg', color: '#e0c97b', dec: 1 },
  stress: { label: 'Stress', unit: '/100', color: '#ffb84f', dec: 0 },
  hrv: { label: 'HRV', unit: 'ms', color: '#b96bff', dec: 0 },
  mindful: { label: 'Mindfulness', unit: 'min', color: '#4fc7e0', dec: 0 },
};

export const moodOptions: [string, string][] = [['Felice', '#7be0b0'], ['Calmo', '#7bb8e0'], ['Neutro', '#8e98a8'], ['Stressato', '#e0c97b'], ['Triste', '#7c93c9'], ['Arrabbiato', '#ff9d9d']];

type HealthState = {
  series: Record<Metric, number[]>;
  lastLog: Partial<Record<Metric, string>>;
  workouts: Workout[];
  mindSessions: MindSession[];
  moods: MoodEntry[];
  wearable: { connected: boolean; device: string | null };

  logMetric: (m: Metric, v: number) => void;
  addWorkout: (type: string, duration: number) => void;
  delWorkout: (id: string) => void;
  addMind: (type: string, duration: number) => void;
  delMind: (id: string) => void;
  logMood: (mood: string) => void;
  connect: (device: string | null) => void;
  reset: () => void;
};

const emptySeries = (): Record<Metric, number[]> => ({ sleep: [], hr: [], steps: [], weight: [], stress: [], hrv: [], mindful: [] });

export const useHealth = create<HealthState>()(
  persisted<HealthState>('health', (set) => ({
    series: emptySeries(),
    lastLog: {},
    workouts: [],
    mindSessions: [],
    moods: [],
    wearable: { connected: false, device: null },

    logMetric: (m, v) =>
      set((s) => {
        const today = dayKey();
        const arr = s.series[m].slice();
        if (s.lastLog[m] === today && arr.length) arr[arr.length - 1] = v;
        else arr.push(v);
        return { series: { ...s.series, [m]: arr.slice(-60) }, lastLog: { ...s.lastLog, [m]: today } };
      }),
    addWorkout: (type, duration) => set((s) => ({ workouts: [{ id: uid(), type, date: weekdayShortDate(), duration, calories: Math.round(duration * 7) }, ...s.workouts] })),
    delWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
    addMind: (type, duration) => set((s) => ({ mindSessions: [{ id: uid(), type, date: weekdayShortDate(), duration }, ...s.mindSessions] })),
    delMind: (id) => set((s) => ({ mindSessions: s.mindSessions.filter((x) => x.id !== id) })),
    logMood: (mood) => set((s) => ({ moods: [{ date: weekdayShortDate(), mood }, ...s.moods] })),
    connect: (device) => set({ wearable: { connected: !!device, device } }),
    reset: () => set({ series: emptySeries(), lastLog: {}, workouts: [], mindSessions: [], moods: [], wearable: { connected: false, device: null } }),
  })),
);

export const last = (a: number[]) => (a.length ? a[a.length - 1] : null);

export function streakOf(arr: number[], pred: (v: number) => boolean): number {
  let s = 0;
  for (let i = arr.length - 1; i >= 0; i--) { if (pred(arr[i])) s++; else break; }
  return s;
}
