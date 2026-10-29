import { create } from 'zustand';

import type { Memo, Repeat } from '@/lib/memo';
import { persisted } from './persist';

type State = {
  memos: Memo[];
  add: (m: { text: string; at: number; repeat?: Repeat }) => Memo;
  update: (id: string, patch: Partial<Pick<Memo, 'text' | 'at' | 'repeat'>>) => void;
  setDone: (id: string, done: boolean) => void;
  remove: (id: string) => Memo | null;
  restore: (m: Memo) => void;
  clearDone: () => void;
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export const useMemos = create<State>()(
  persisted<State>('memos', (set, get) => ({
    memos: [],
    add: (m) => { const memo: Memo = { id: uid(), text: m.text.trim(), at: m.at, repeat: m.repeat ?? 'none' }; set((s) => ({ memos: [...s.memos, memo] })); return memo; },
    update: (id, patch) => set((s) => ({ memos: s.memos.map((x) => (x.id === id ? { ...x, ...patch, done: false, doneAt: undefined } : x)) })),
    setDone: (id, done) => set((s) => ({ memos: s.memos.map((x) => (x.id === id ? { ...x, done, doneAt: done ? Date.now() : undefined } : x)) })),
    remove: (id) => { const m = get().memos.find((x) => x.id === id) ?? null; if (m) set((s) => ({ memos: s.memos.filter((x) => x.id !== id) })); return m; },
    restore: (m) => set((s) => (s.memos.some((x) => x.id === m.id) ? s : { memos: [...s.memos, m] })),
    clearDone: () => set((s) => ({ memos: s.memos.filter((x) => !x.done) })),
  }), (s) => ({ memos: s.memos }), { sensitive: true }),
);
