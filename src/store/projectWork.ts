import { create } from 'zustand';

import { dayKey } from '@/lib/format';
import { elapsedMs, pauseTimer, startTimer, type TaskTimer } from '@/lib/taskTimer';
import { verbOf, type WorkHistory } from '@/lib/workEstimate';

import { persisted } from './persist';

/** «Inizia a lavorare» sui progetti: la task su cui stai lavorando adesso, il tempo stimato e lo storico di quanto ci hai messo. Resta sul telefono. */
export type WorkSession = { rootId: string; nodeId: string; title: string; est: number; timer: TaskTimer; startedAt: number };
type State = {
  session: WorkSession | null;
  history: WorkHistory[];
  /** task finite con «Inizia a lavorare», per giorno */
  doneByDay: Record<string, number>;
  start: (s: { rootId: string; nodeId: string; title: string; est: number }) => void;
  pause: () => void;
  resume: () => void;
  addMinutes: (n: number) => void;
  cancel: () => void;
  /** chiude la sessione: ritorna i minuti reali (arrotondati) */
  finish: () => number;
  reset: () => void;
};

export const useProjectWork = create<State>()(persisted<State>('projectWork', (set, get) => ({
  session: null,
  history: [],
  doneByDay: {},
  start: (s) => set({ session: { ...s, timer: startTimer(undefined, Date.now()), startedAt: Date.now() } }),
  pause: () => set((st) => (st.session ? { session: { ...st.session, timer: pauseTimer(st.session.timer, Date.now()) } } : {})),
  resume: () => set((st) => (st.session ? { session: { ...st.session, timer: startTimer(st.session.timer, Date.now()) } } : {})),
  addMinutes: (n) => set((st) => (st.session ? { session: { ...st.session, est: Math.max(5, Math.min(240, st.session.est + n)) } } : {})),
  cancel: () => set({ session: null }),
  finish: () => {
    const s = get().session; if (!s) return 0;
    const min = Math.max(1, Math.round(elapsedMs(s.timer, Date.now()) / 60000));
    const today = dayKey();
    set((st) => ({ session: null, history: [...st.history, { verb: verbOf(s.title), est: s.est, actual: min }].slice(-60), doneByDay: { ...st.doneByDay, [today]: (st.doneByDay[today] ?? 0) + 1 } }));
    return min;
  },
  reset: () => set({ session: null, history: [], doneByDay: {} }),
})));
