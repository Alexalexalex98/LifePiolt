import { create } from 'zustand';

import { persisted } from './persist';

type State = {
  /** avvisi chiusi dall'utente (non tornano) */
  dismissed: string[];
  dismiss: (id: string) => void;
};

export const useRadar = create<State>()(
  persisted<State>('radar', (set, get) => ({
    dismissed: [],
    dismiss: (id) => set({ dismissed: [id, ...get().dismissed.filter((x) => x !== id)].slice(0, 200) }),
  })),
);
