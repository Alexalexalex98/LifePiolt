import { create } from 'zustand';

import { persisted } from './persist';

export type WeatherDay = { rain: number; tmax: number; sun: number };

type ContextState = {
  /** città per il meteo (si digita una volta; non serve il permesso di posizione) */
  city: string;
  lat: number | null;
  lon: number | null;
  days: Record<string, WeatherDay>;
  fetchedAt: number | null;
  source: 'open-meteo' | 'demo' | null;
  error: string | null;
  set: (p: Partial<ContextState>) => void;
  reset: () => void;
};

const initial = { city: '', lat: null as number | null, lon: null as number | null, days: {} as Record<string, WeatherDay>, fetchedAt: null as number | null, source: null as ContextState['source'], error: null as string | null };

export const useContext = create<ContextState>()(
  persisted<ContextState>('context', (set) => ({
    ...initial,
    set: (p) => set(p),
    reset: () => set({ ...initial }),
  })),
);
