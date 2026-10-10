import { create } from 'zustand';

import type { LiveSummary } from '@/lib/liveRoom';
import { persisted } from './persist';

/**
 * Dati delle dirette: modalita' online/in presenza scelta da chi organizza (per id seminario/servizio)
 * e riepiloghi delle dirette concluse. Non tocca store/network.ts.
 */
type State = {
  /** 'seminar:12' / 'service:Nome' -> online (true) o in presenza (false). Se manca vale il dato originale. */
  online: Record<string, boolean>;
  summaries: LiveSummary[];
  setOnline: (key: string, v: boolean) => void;
  addSummary: (s: LiveSummary) => void;
  removeSummary: (id: string) => void;
  restoreSummary: (s: LiveSummary) => void;
  reset: () => void;
};

export const useLive = create<State>()(
  persisted<State>('live', (set) => ({
    online: {},
    summaries: [],
    setOnline: (key, v) => set((s) => ({ online: { ...s.online, [key]: v } })),
    addSummary: (sm) => set((s) => ({ summaries: [sm, ...s.summaries.filter((x) => x.id !== sm.id)].slice(0, 50) })),
    removeSummary: (id) => set((s) => ({ summaries: s.summaries.filter((x) => x.id !== id) })),
    restoreSummary: (sm) => set((s) => ({ summaries: [sm, ...s.summaries.filter((x) => x.id !== sm.id)].sort((a, b) => b.endedAt - a.endedAt).slice(0, 50) })),
    reset: () => set({ online: {}, summaries: [] }),
  })),
);
