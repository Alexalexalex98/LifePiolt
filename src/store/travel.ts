import { create } from 'zustand';

import { uid } from '@/lib/format';
import { persisted } from './persist';

export type SavedItinerary = { id: string; city: string; hotel: string; price: number; days: number; tripTotal: number; month: string };

type TravelState = {
  style: 'budget' | 'comfort' | 'speed';
  hotelIdx: number | null;
  city: string;
  monthOffset: number;
  guests: { adults: number; children: number; pets: boolean; rooms: number };
  saved: SavedItinerary[];
  set: (p: Partial<TravelState>) => void;
  save: (i: Omit<SavedItinerary, 'id'>) => void;
  del: (id: string) => SavedItinerary | null;
  restore: (i: SavedItinerary) => void;
  reset: () => void;
};

const initial = {
  style: 'comfort' as const,
  hotelIdx: null as number | null,
  city: 'lucerna',
  monthOffset: 0,
  guests: { adults: 2, children: 0, pets: false, rooms: 1 },
  saved: [] as SavedItinerary[],
};

export const useTravel = create<TravelState>()(
  persisted<TravelState>('travel', (set, get) => ({
    ...initial,
    set: (p) => set(p),
    save: (i) => set((s) => ({ saved: [{ id: uid(), ...i }, ...s.saved] })),
    del: (id) => {
      const it = get().saved.find((x) => x.id === id) ?? null;
      set((s) => ({ saved: s.saved.filter((x) => x.id !== id) }));
      return it;
    },
    restore: (i) => set((s) => ({ saved: [i, ...s.saved] })),
    reset: () => set({ ...initial }),
  })),
);
