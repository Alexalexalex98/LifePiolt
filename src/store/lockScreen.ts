import { create } from 'zustand';

import type { LockCat } from '@/lib/lockScreen';
import { persisted } from './persist';

type State = {
  /** mostra qualcosa sul blocco schermo e nei widget */
  on: boolean;
  cats: Record<LockCat, boolean>;
  /** niente nomi sul blocco schermo: solo il tipo e l'ora */
  hideTitles: boolean;
  set: (p: Partial<Pick<State, 'on' | 'hideTitles'>>) => void;
  toggle: (c: LockCat) => void;
};

export const useLockScreen = create<State>()(
  persisted<State>('lockScreen', (set, get) => ({
    on: true,
    cats: { turni: true, impegni: true, task: true, acqua: false, allenamento: false },
    hideTitles: false,
    set: (p) => set(p),
    toggle: (c) => set({ cats: { ...get().cats, [c]: !get().cats[c] } }),
  })),
);
