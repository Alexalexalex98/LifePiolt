import { create } from 'zustand';

import { addEntry, makeEntry, type KbEntry } from '@/lib/theiaMemory';

import { persisted } from './persist';

/** Quello che Theia ha imparato dalle risposte dell'AI (solo conoscenza generale): resta sul telefono e si può cancellare. */
type State = {
  entries: KbEntry[];
  learn: (question: string, reply: string) => void;
  used: (id: string) => void;
  forget: (id: string) => void;
  clear: () => void;
};

export const useTheiaMemory = create<State>()(
  persisted<State>('theiaMemory', (set) => ({
    entries: [],
    learn: (q, a) => set((s) => ({ entries: addEntry(s.entries, makeEntry(q, a)) })),
    used: (id) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, uses: e.uses + 1 } : e)) })),
    forget: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    clear: () => set({ entries: [] }),
  })),
);
