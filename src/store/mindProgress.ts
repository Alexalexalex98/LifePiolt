import { create } from 'zustand';

import { persisted } from './persist';

/** Cosa hai già fatto dei programmi e come ti sentivi prima e dopo (0–10). Resta sul telefono, si cancella dal Centro Privacy. */
export type Feel = { id: string; session: string; ts: number; before?: number; after?: number };
type State = { done: Record<string, number[]>; feel: Feel[]; finish: (session: string, before?: number, after?: number) => void; clear: () => void };
export const useMindProgress = create<State>()(persisted<State>('mindProgress', (set) => ({
  done: {}, feel: [],
  finish: (session, before, after) => set((s) => ({ done: { ...s.done, [session]: [...(s.done[session] ?? []), Date.now()] }, feel: [...s.feel, { id: Math.random().toString(36).slice(2, 8), session, ts: Date.now(), before, after }].slice(-300) })),
  clear: () => set({ done: {}, feel: [] }),
}), (s) => ({ done: s.done, feel: s.feel }), { sensitive: true }));
