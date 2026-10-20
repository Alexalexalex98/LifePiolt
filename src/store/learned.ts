import { create } from 'zustand';

import { toPattern, type Learned } from '@/lib/assistant/learned';
import type { SharedCmd } from '@/social/socialCore';
import { persisted } from './persist';

type State = {
  items: Learned[];
  /** frase che Theia sta imparando adesso (aspetta che le si mostri cosa fare); non si salva */
  teaching: string | null;
  /** comandi insegnati da altri e confermati (scaricati dal server) */
  shared: SharedCmd[];
  sharedAt: number;
  /** comandi condivisi che hai scartato: non si usano più */
  blocked: string[];
  setShared: (l: SharedCmd[]) => void;
  block: (id: string) => void;
  startTeach: (phrase: string) => void;
  stopTeach: () => void;
  learn: (phrase: string, kind: Learned['kind'], target: string) => Learned;
  use: (id: string) => void;
  forget: (id: string) => void;
};
const uid = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Quello che Theia ha imparato dall'utente: resta sul telefono. */
export const useLearned = create<State>()(
  persisted<State>('learned', (set, get) => ({
    items: [], teaching: null, shared: [], sharedAt: 0, blocked: [],
    setShared: (l) => set({ shared: l, sharedAt: Date.now() }),
    block: (id) => set((s) => ({ blocked: [...new Set([...(s.blocked ?? []), id])] })),
    startTeach: (phrase) => set({ teaching: phrase }),
    stopTeach: () => set({ teaching: null }),
    learn: (phrase, kind, target) => {
      const pattern = toPattern(phrase);
      const existing = get().items.find((i) => i.pattern === pattern);
      const item: Learned = { id: existing?.id ?? uid(), pattern, kind, target, uses: existing?.uses ?? 0, ts: Date.now() };
      set((s) => ({ items: [item, ...s.items.filter((i) => i.pattern !== pattern)].slice(0, 300), teaching: null }));
      return item;
    },
    use: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, uses: i.uses + 1 } : i)) })),
    forget: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  }), (s) => ({ items: s.items, shared: s.shared, sharedAt: s.sharedAt, blocked: s.blocked }) as Partial<State>),
);
