import { create } from 'zustand';

import { persisted } from './persist';

/** La chat di Theia Lavoro: separata dalla Theia personale (niente memoria condivisa, niente dati personali dell'app). */
export type WsAction = { label: string; op: 'pick' | 'all' | 'dismiss' | 'ai' };
export type WsMsg = { id: string; who: 'me' | 'ai'; text: string; ts: number; sources?: string[]; files?: string[]; actions?: WsAction[] };
type State = {
  log: WsMsg[];
  /** file di LifeDrive di cui stiamo parlando (scelti o caricati) */
  focus: string[];
  /** 'ask' = prima di cercare in tutti i file chiede se vuoi indicare tu il file; 'all' = cerca in tutti */
  mode: 'ask' | 'all';
  /** domanda in attesa della scelta del file */
  pending?: string;
  /** file di LifeDrive collegati al workspace senza spostarli */
  linked: string[];
  push: (m: Omit<WsMsg, 'id' | 'ts'>) => string;
  patch: (id: string, p: Partial<WsMsg>) => void;
  set: (p: Partial<Pick<State, 'focus' | 'mode' | 'pending' | 'linked'>>) => void;
  clear: () => void;
};
export const useWorkspaceChat = create<State>()(persisted<State>('workspaceChat', (set) => ({
  log: [], focus: [], mode: 'ask', linked: [],
  push: (m) => { const id = Math.random().toString(36).slice(2, 9); set((s) => ({ log: [...s.log, { ...m, id, ts: Date.now() }].slice(-80) })); return id; },
  patch: (id, p) => set((s) => ({ log: s.log.map((m) => (m.id === id ? { ...m, ...p } : m)) })),
  set: (p) => set(p),
  clear: () => set({ log: [], focus: [], mode: 'ask', pending: undefined }),
}), (s) => ({ log: s.log, focus: s.focus, mode: s.mode, linked: s.linked }), { sensitive: true }));
