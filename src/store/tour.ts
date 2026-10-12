import { create } from 'zustand';

import { applyUnlock, emptyTourState, initialState, markSeen, nextUnlock, unlockAll, unlockUpTo, type Signals, type TourMode, type TourState } from '@/lib/tour';

import { persisted } from './persist';

type Runtime = {
  /** tour in corso (id) e passo corrente: non salvati */
  active: string | null;
  step: number;
  /** pagina bloccata di cui si sta chiedendo lo sblocco */
  lockPrompt: string | null;
};

type Actions = {
  /** decide il percorso alla prima apertura */
  init: (mode: TourMode, signals: Signals) => void;
  /** valuta lo sblocco progressivo; restituisce il livello sbloccato (se c'è) */
  tick: (signals: Signals) => number | null;
  unlockTo: (level: number, signals: Signals) => void;
  unlockEverything: () => void;
  start: (id: string) => void;
  next: (total: number) => void;
  back: () => void;
  finish: () => void;
  promptLock: (page: string | null) => void;
  /** disattiva (o riattiva) i tutorial che partono da soli aprendo una sezione */
  setTutOff: (v: boolean) => void;
  /** rimette tutti i tutorial delle sezioni come «da vedere» */
  resetTutorials: () => void;
  reset: () => void;
};

export type TourStore = TourState & Runtime & Actions;

const persistedKeys = (s: TourStore): TourState => ({ mode: s.mode, level: s.level, allUnlocked: s.allUnlocked, unlockedAt: s.unlockedAt, baseline: s.baseline, seen: s.seen, startedAt: s.startedAt, pending: s.pending, tutOff: s.tutOff });
const base = (s: TourStore): TourState => persistedKeys(s);

export const useTour = create<TourStore>()(
  persisted<TourStore>('tour', (set, get) => ({
    ...emptyTourState(),
    active: null,
    step: 0,
    lockPrompt: null,
    init: (mode, signals) => set(initialState(mode, Date.now(), signals)),
    tick: (signals) => {
      const s = base(get());
      const n = nextUnlock(s, signals, Date.now());
      if (!n) return null;
      set(applyUnlock(s, n.level, signals, Date.now()));
      return n.level;
    },
    unlockTo: (level, signals) => set(unlockUpTo(base(get()), level, signals, Date.now())),
    unlockEverything: () => set(unlockAll(base(get()), Date.now())),
    start: (id) => set({ active: id, step: 0 }),
    next: (total) => set((s) => (s.step + 1 >= total ? {} : { step: s.step + 1 })),
    back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
    finish: () => {
      const id = get().active;
      if (!id) return;
      const done = markSeen(base(get()), id);
      set({ ...done, active: null, step: 0 });
    },
    promptLock: (lockPrompt) => set({ lockPrompt }),
    setTutOff: (tutOff) => set({ tutOff }),
    resetTutorials: () => set((s) => ({ seen: s.seen.filter((x) => !x.startsWith('sec-')), tutOff: false })),
    reset: () => set({ ...emptyTourState(), active: null, step: 0, lockPrompt: null }),
  }), persistedKeys),
);
