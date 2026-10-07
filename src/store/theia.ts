import { create } from 'zustand';

import type { TheiaRequest } from '@/lib/theia';
import { persisted } from './persist';

type TheiaState = {
  open: boolean;
  req: TheiaRequest | null;
  /** suggerimenti nascosti dall'utente (id → timestamp) */
  dismissed: Record<string, number>;
  openWith: (req: TheiaRequest) => void;
  close: () => void;
  dismiss: (id: string) => void;
};

export const useTheia = create<TheiaState>()(
  persisted<TheiaState>('theia', (set) => ({
    open: false,
    req: null,
    dismissed: {},
    openWith: (req) => set({ open: true, req }),
    close: () => set({ open: false }),
    dismiss: (id) => set((s) => ({ dismissed: { ...s.dismissed, [id]: Date.now() } })),
  }), (s) => ({ dismissed: s.dismissed })),
);

/** Apre Theia con un testo o un'immagine (da chat, note, ovunque). */
export const askTheiaAbout = (req: TheiaRequest) => useTheia.getState().openWith(req);
