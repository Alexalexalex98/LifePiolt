import { create } from 'zustand';

import { persisted } from './persist';

type State = {
  /** avvisi chiusi dall'utente (non tornano) */
  dismissed: string[];
  dismiss: (id: string) => void;
  /** notifiche del radar: spente di base, le accendi tu */
  notify: { on: boolean; hour: number; minute: number };
  setNotify: (p: Partial<State['notify']>) => void;
};

export const useRadar = create<State>()(
  persisted<State>('radar', (set, get) => ({
    dismissed: [],
    notify: { on: false, hour: 9, minute: 0 },
    setNotify: (p) => set({ notify: { ...get().notify, ...p } }),
    dismiss: (id) => set({ dismissed: [id, ...get().dismissed.filter((x) => x !== id)].slice(0, 200) }),
  })),
);
