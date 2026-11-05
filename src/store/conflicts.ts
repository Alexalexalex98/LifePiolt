import { create } from 'zustand';

import { persisted } from './persist';

/** Riunioni in arrivo che si scontrano con un tuo impegno (si ricalcolano a ogni aggiornamento) e quelle che hai deciso di ignorare. */
export type Clash = { id: string; team: string; day: string; time: string; dur: number; title: string; by?: string; otherDay: string; otherIdx: number; otherTitle: string; otherTime: string };
type State = { clashes: Clash[]; ignored: string[]; set: (p: Partial<Omit<State, 'set'>>) => void };
export const useConflicts = create<State>()(persisted<State>('conflicts', (set) => ({ clashes: [], ignored: [], set: (p) => set(p) }), (s) => ({ ignored: s.ignored.slice(-100) })));
