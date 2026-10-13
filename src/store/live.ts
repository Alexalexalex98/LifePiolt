import { create } from 'zustand';

import type { LiveSummary } from '@/lib/liveRoom';
import type { LiveRecording } from '@/lib/recordings';
import { persisted } from './persist';

/**
 * Dati delle dirette: modalita' online/in presenza scelta da chi organizza (per id seminario/servizio)
 * e riepiloghi delle dirette concluse. Non tocca store/network.ts.
 */
type State = {
  /** 'seminar:12' / 'service:Nome' -> online (true) o in presenza (false). Se manca vale il dato originale. */
  online: Record<string, boolean>;
  summaries: LiveSummary[];
  /** registrazioni delle dirette (di chi le ha tenute) */
  recordings: LiveRecording[];
  addRecording: (r: LiveRecording) => void;
  patchRecording: (id: string, p: Partial<LiveRecording>) => void;
  removeRecording: (id: string) => void;
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
    recordings: [],
    addRecording: (r) => set((s) => ({ recordings: [r, ...(s.recordings ?? []).filter((x) => x.id !== r.id)].slice(0, 100) })),
    patchRecording: (id, p) => set((s) => ({ recordings: (s.recordings ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    removeRecording: (id) => set((s) => ({ recordings: (s.recordings ?? []).filter((x) => x.id !== id) })),
    setOnline: (key, v) => set((s) => ({ online: { ...s.online, [key]: v } })),
    addSummary: (sm) => set((s) => ({ summaries: [sm, ...s.summaries.filter((x) => x.id !== sm.id)].slice(0, 50) })),
    removeSummary: (id) => set((s) => ({ summaries: s.summaries.filter((x) => x.id !== id) })),
    restoreSummary: (sm) => set((s) => ({ summaries: [sm, ...s.summaries.filter((x) => x.id !== sm.id)].sort((a, b) => b.endedAt - a.endedAt).slice(0, 50) })),
    reset: () => set({ online: {}, summaries: [], recordings: [] }),
  })),
);
