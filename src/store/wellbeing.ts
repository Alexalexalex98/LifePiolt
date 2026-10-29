import { create } from 'zustand';

import type { QKind } from '@/lib/wellbeing/questionnaires';
import { persisted } from './persist';

export type WbResult = { id: string; ts: number; kind: QKind; score: number; max: number; label: string };
type State = {
  /** consenso esplicito al monitoraggio del benessere (dati sanitari): senza, nessun calcolo e nessun questionario */
  consent: boolean;
  consentAt: number;
  results: WbResult[];
  /** questionario in corso (risposte date finora) */
  progress: { kind: QKind; answers: number[] } | null;
  /** ultima volta che Theia ha proposto un questionario / segnalato un cambiamento (per non insistere) */
  lastOffer: number;
  lastNotice: number;
  setConsent: (v: boolean) => void;
  start: (kind: QKind) => void;
  answer: (v: number) => { kind: QKind; answers: number[] } | null;
  finish: (r: Omit<WbResult, 'id' | 'ts'>) => void;
  cancel: () => void;
  mark: (patch: Partial<Pick<State, 'lastOffer' | 'lastNotice'>>) => void;
  /** cancella tutto ciò che riguarda il benessere (risultati, progresso, consenso) */
  clearAll: () => void;
};

const empty = { consent: false, consentAt: 0, results: [] as WbResult[], progress: null as State['progress'], lastOffer: 0, lastNotice: 0 };

export const useWellbeing = create<State>()(
  persisted<State>('wellbeing', (set, get) => ({
    ...empty,
    setConsent: (v) => set(v ? { consent: true, consentAt: Date.now() } : { consent: false }),
    start: (kind) => set({ progress: { kind, answers: [] } }),
    answer: (v) => { const p = get().progress; if (!p) return null; const next = { kind: p.kind, answers: [...p.answers, v] }; set({ progress: next }); return next; },
    finish: (r) => set((s) => ({ progress: null, results: [{ id: Math.random().toString(36).slice(2), ts: Date.now(), ...r }, ...s.results].slice(0, 60) })),
    cancel: () => set({ progress: null }),
    mark: (patch) => set(patch),
    clearAll: () => set({ ...empty }),
  }), (s) => ({ consent: s.consent, consentAt: s.consentAt, results: s.results, progress: s.progress, lastOffer: s.lastOffer, lastNotice: s.lastNotice }), { sensitive: true }),
);
