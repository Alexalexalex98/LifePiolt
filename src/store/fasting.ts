import { create } from 'zustand';

import { persisted } from './persist';

/** Digiuno intermittente: acceso/spento, schema e ora di inizio della finestra del cibo. */
type State = {
  on: boolean; plan: string; start: string;
  set: (p: Partial<Omit<State, 'set'>>) => void;
};
export const useFasting = create<State>()(persisted<State>('fasting', (set) => ({ on: false, plan: '16:8', start: '12:00', set: (p) => set(p) }), (s) => ({ on: s.on, plan: s.plan, start: s.start })));
