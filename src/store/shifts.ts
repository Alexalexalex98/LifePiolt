import { create } from 'zustand';

import { uid } from '@/lib/format';
import type { Shift } from '@/lib/shifts';
import { persisted } from './persist';

type State = {
  shifts: Shift[];
  save: (s: Omit<Shift, 'id'> & { id?: string }) => void;
  remove: (id: string) => void;
};

/** I turni di lavoro: restano sul telefono. */
export const useShifts = create<State>()(
  persisted<State>('shifts', (set, get) => ({
    shifts: [],
    save: (s) => {
      if (s.id && get().shifts.some((x) => x.id === s.id)) set({ shifts: get().shifts.map((x) => (x.id === s.id ? { ...x, ...s, id: x.id } : x)) });
      else set({ shifts: [...get().shifts, { ...s, id: s.id ?? uid() }] });
    },
    remove: (id) => set({ shifts: get().shifts.filter((x) => x.id !== id) }),
  })),
);
