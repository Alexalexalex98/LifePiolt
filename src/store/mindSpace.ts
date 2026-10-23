import { create } from 'zustand';

import type { Answer, Entry } from '@/lib/mindExercises';

import { persisted } from './persist';

/** Il diario delle attività fatte insieme alla creatura: resta sul telefono, si esporta e si cancella dal Centro Privacy. */
type State = {
  entries: Entry[];
  add: (ex: string, answers: Record<string, Answer>) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useMindSpace = create<State>()(
  persisted<State>('mindSpace', (set) => ({
    entries: [],
    add: (ex, answers) => set((s) => ({ entries: [...s.entries, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ex, ts: Date.now(), answers }].slice(-500) })),
    remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    clear: () => set({ entries: [] }),
  })),
);
