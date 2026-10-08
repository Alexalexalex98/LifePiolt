import { create } from 'zustand';

import { persisted } from './persist';

type DiscoverState = {
  /** dopo i primi giorni: mostra la "funzione del giorno" all'apertura (si può spegnere) */
  showOnOpen: boolean;
  /** quando l'app è stata aperta la prima volta (serve a limitare la guida completa ai primi giorni) */
  firstSeenAt: number | null;
  /** ultimo giorno in cui è comparsa la funzione del giorno (una volta al giorno) */
  lastBiteDay: number | null;
  open: boolean;
  /** 'full' = tutte le aree; 'bite' = una sola funzione */
  mode: 'full' | 'bite';
  setShowOnOpen: (v: boolean) => void;
  set: (p: Partial<DiscoverState>) => void;
  show: (mode?: 'full' | 'bite') => void;
  hide: () => void;
};

export const useDiscover = create<DiscoverState>()(
  persisted<DiscoverState>('discover', (set) => ({
    showOnOpen: false,
    firstSeenAt: null,
    lastBiteDay: null,
    open: false,
    mode: 'full',
    setShowOnOpen: (showOnOpen) => set({ showOnOpen }),
    set: (p) => set(p),
    show: (mode = 'full') => set({ open: true, mode }),
    hide: () => set({ open: false }),
  }), (s) => ({ showOnOpen: s.showOnOpen, firstSeenAt: s.firstSeenAt, lastBiteDay: s.lastBiteDay })),
);
