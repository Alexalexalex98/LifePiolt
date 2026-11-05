import { create } from 'zustand';

import type { WorkMood } from '@/lib/workWell';
import { persisted } from './persist';

/** Benessere sul lavoro. Resta sul telefono: non va al server, né al team, né al responsabile. */
type State = {
  /** non avvisarmi degli impegni di lavoro fuori dal mio orario */
  disconnect: boolean;
  /** consenso al controllo dell'umore al lavoro (solo per me) */
  moodOn: boolean;
  moods: WorkMood[];
  set: (p: Partial<Omit<State, 'set' | 'setMood' | 'clear'>>) => void;
  setMood: (m: WorkMood) => void;
  clear: () => void;
};
export const useWorkWell = create<State>()(persisted<State>('workWell', (set) => ({
  disconnect: false, moodOn: false, moods: [],
  set: (p) => set(p),
  setMood: (m) => set((s) => ({ moods: [...s.moods.filter((x) => x.day !== m.day), m].sort((a, b) => a.day.localeCompare(b.day)).slice(-120) })),
  clear: () => set({ moods: [], moodOn: false }),
}), (s) => ({ disconnect: s.disconnect, moodOn: s.moodOn, moods: s.moods }), { sensitive: true }));
