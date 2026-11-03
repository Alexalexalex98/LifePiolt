import { create } from 'zustand';

import { persisted } from './persist';

/** La chat dell'assistente di LifeWorkspace: separata da Theia (niente memoria condivisa, niente dati personali dell'app). */
export type WsMsg = { id: string; who: 'me' | 'ai'; text: string; ts: number; sources?: string[] };
type State = { log: WsMsg[]; push: (m: Omit<WsMsg, 'id' | 'ts'>) => void; clear: () => void };
export const useWorkspaceChat = create<State>()(persisted<State>('workspaceChat', (set) => ({
  log: [],
  push: (m) => set((s) => ({ log: [...s.log, { ...m, id: Math.random().toString(36).slice(2, 9), ts: Date.now() }].slice(-60) })),
  clear: () => set({ log: [] }),
}), (s) => ({ log: s.log }), { sensitive: true }));
