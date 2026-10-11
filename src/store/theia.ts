import { create } from 'zustand';

import type { TheiaRequest } from '@/lib/theia';
import { persisted } from './persist';

type TheiaState = {
  open: boolean;
  req: TheiaRequest | null;
  /** suggerimenti nascosti dall'utente (id → timestamp) */
  dismissed: Record<string, number>;
  /** voce: invia subito dopo aver parlato (false = prima mostra il testo per conferma) */
  voiceAuto: boolean;
  openWith: (req: TheiaRequest) => void;
  close: () => void;
  dismiss: (id: string) => void;
  setVoiceAuto: (v: boolean) => void;
};

export const useTheia = create<TheiaState>()(
  persisted<TheiaState>('theia', (set) => ({
    open: false,
    req: null,
    dismissed: {},
    voiceAuto: false,
    openWith: (req) => set({ open: true, req }),
    close: () => set({ open: false }),
    dismiss: (id) => set((s) => ({ dismissed: { ...s.dismissed, [id]: Date.now() } })),
    setVoiceAuto: (voiceAuto) => set({ voiceAuto }),
  }), (s) => ({ dismissed: s.dismissed, voiceAuto: s.voiceAuto })),
);

/** Apre Theia con un testo o un'immagine (da chat, note, ovunque). */
export const askTheiaAbout = (req: TheiaRequest) => useTheia.getState().openWith(req);
