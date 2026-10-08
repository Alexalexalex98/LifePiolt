import { create } from 'zustand';

import { persisted } from './persist';

type DiscoverState = {
  /** mostra la guida a ogni apertura dell'app (si può spegnere) */
  showOnOpen: boolean;
  open: boolean;
  setShowOnOpen: (v: boolean) => void;
  show: () => void;
  hide: () => void;
};

export const useDiscover = create<DiscoverState>()(
  persisted<DiscoverState>('discover', (set) => ({
    showOnOpen: true,
    open: false,
    setShowOnOpen: (showOnOpen) => set({ showOnOpen }),
    show: () => set({ open: true }),
    hide: () => set({ open: false }),
  }), (s) => ({ showOnOpen: s.showOnOpen })),
);
