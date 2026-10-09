import { create } from 'zustand';

import { persisted } from './persist';

export type CalView = 'month' | 'week' | 'agenda';

/** Preferenze del calendario del Plan (vista preferita e legenda aperta): si ricordano tra una sessione e l'altra. */
type State = { view: CalView; legendOpen: boolean; setView: (v: CalView) => void; setLegend: (v: boolean) => void };

export const useCalPrefs = create<State>()(
  persisted<State>('calprefs', (set) => ({
    view: 'month',
    legendOpen: false,
    setView: (view) => set({ view }),
    setLegend: (legendOpen) => set({ legendOpen }),
  })),
);
