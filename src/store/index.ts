import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { todayKey, uid } from '@/lib/id';

export type Task = { id: string; title: string; done: boolean; due?: string };
export type Goal = { id: string; title: string; progress: number };
export type Note = { id: string; title: string; body: string; updatedAt: number };
export type Mood = 1 | 2 | 3 | 4 | 5;
export type HealthDay = { sleepHours?: number; steps?: number; weightKg?: number; mood?: Mood };
export type Tx = { id: string; label: string; amount: number; category: string; date: string };
export type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string };
export type ThemeMode = 'dark' | 'light' | 'system';

type State = {
  name: string;
  theme: ThemeMode;
  tasks: Task[];
  goals: Goal[];
  notes: Note[];
  health: Record<string, HealthDay>;
  salary: number;
  txs: Tx[];
  chat: ChatMsg[];
  notifications: { push: boolean; digest: boolean };
  onboarded: boolean;

  setName: (n: string) => void;
  setTheme: (t: ThemeMode) => void;
  setNotif: (k: 'push' | 'digest', v: boolean) => void;
  finishOnboarding: () => void;

  addTask: (title: string, due?: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  addGoal: (title: string) => void;
  setGoalProgress: (id: string, p: number) => void;
  removeGoal: (id: string) => void;

  saveNote: (n: Partial<Note> & { title: string; body: string }) => void;
  removeNote: (id: string) => void;

  logHealth: (patch: HealthDay, day?: string) => void;
  setSalary: (n: number) => void;
  addTx: (t: Omit<Tx, 'id' | 'date'> & { date?: string }) => void;
  removeTx: (id: string) => void;

  pushChat: (m: Omit<ChatMsg, 'id'>) => void;
  clearChat: () => void;
  deleteAllData: () => void;
};

const initial = {
  name: '',
  theme: 'dark' as ThemeMode,
  tasks: [] as Task[],
  goals: [] as Goal[],
  notes: [] as Note[],
  health: {} as Record<string, HealthDay>,
  salary: 0,
  txs: [] as Tx[],
  chat: [] as ChatMsg[],
  notifications: { push: false, digest: false },
  onboarded: false,
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initial,
      setName: (name) => set({ name }),
      setTheme: (theme) => set({ theme }),
      setNotif: (k, v) => set((s) => ({ notifications: { ...s.notifications, [k]: v } })),
      finishOnboarding: () => set({ onboarded: true }),

      addTask: (title, due) => set((s) => ({ tasks: [{ id: uid(), title, done: false, due }, ...s.tasks] })),
      toggleTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      addGoal: (title) => set((s) => ({ goals: [...s.goals, { id: uid(), title, progress: 0 }] })),
      setGoalProgress: (id, p) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, progress: Math.max(0, Math.min(100, p)) } : g)) })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      saveNote: (n) =>
        set((s) => {
          const now = Date.now();
          if (n.id && s.notes.some((x) => x.id === n.id)) {
            return { notes: s.notes.map((x) => (x.id === n.id ? { ...x, title: n.title, body: n.body, updatedAt: now } : x)) };
          }
          return { notes: [{ id: uid(), title: n.title, body: n.body, updatedAt: now }, ...s.notes] };
        }),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      logHealth: (patch, day = todayKey()) => set((s) => ({ health: { ...s.health, [day]: { ...s.health[day], ...patch } } })),
      setSalary: (salary) => set({ salary }),
      addTx: (t) => set((s) => ({ txs: [{ id: uid(), date: t.date ?? todayKey(), label: t.label, amount: t.amount, category: t.category }, ...s.txs] })),
      removeTx: (id) => set((s) => ({ txs: s.txs.filter((t) => t.id !== id) })),

      pushChat: (m) => set((s) => ({ chat: [...s.chat, { ...m, id: uid() }].slice(-200) })),
      clearChat: () => set({ chat: [] }),
      deleteAllData: () => set({ ...initial }),
    }),
    { name: 'lifepilot-store-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
