import { create } from 'zustand';

import { persisted } from './persist';

/** Copia sul telefono dello stato della prova (la verità è sul server). `lastNoteDay` = l'ultima tappa su cui Theia ha già fatto il punto. */
type State = {
  startedAt?: number;
  plan: string;
  syncedAt?: number;
  lastNoteDay: number;
  set: (p: Partial<Omit<State, 'set' | 'clear'>>) => void;
  clear: () => void;
};
export const useTrial = create<State>()(
  persisted<State>('trial', (set) => ({
    plan: 'free', lastNoteDay: 0,
    set: (p) => set(p),
    clear: () => set({ startedAt: undefined, plan: 'free', syncedAt: undefined, lastNoteDay: 0 }),
  }), (s) => ({ startedAt: s.startedAt, plan: s.plan, syncedAt: s.syncedAt, lastNoteDay: s.lastNoteDay })),
);
