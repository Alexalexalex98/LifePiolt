import { create } from 'zustand';

import type { Spec } from '@/lib/creative/spec';
import { persisted } from './persist';

export type CreationStatus = 'bozza' | 'in_revisione' | 'approvata' | 'rifiutata';
export type Visibility = 'free' | 'private' | 'shared';
export type CreationMsg = { who: 'me' | 'ai'; text: string };
export type Creation = {
  id: string; title: string; spec: Spec | null; chat: CreationMsg[];
  status: CreationStatus; visibility: Visibility; sharedWith: string[]; installed: boolean;
  createdAt: number; submittedAt?: number; reviewNote?: string;
  /** accettazione delle condizioni per le proposte: versione, data e consenso ad essere contattati */
  terms?: { version: number; at: number; contactOk: boolean };
};

type State = {
  items: Creation[];
  create: () => Creation;
  patch: (id: string, p: Partial<Creation>) => void;
  remove: (id: string) => Creation | null;
  restore: (c: Creation) => void;
};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export const useCreations = create<State>()(
  persisted<State>('creations', (set, get) => ({
    items: [],
    create: () => { const c: Creation = { id: uid(), title: '', spec: null, chat: [], status: 'bozza', visibility: 'private', sharedWith: [], installed: false, createdAt: Date.now() }; set((s) => ({ items: [c, ...s.items] })); return c; },
    patch: (id, p) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    remove: (id) => { const c = get().items.find((x) => x.id === id) ?? null; if (c) set((s) => ({ items: s.items.filter((x) => x.id !== id) })); return c; },
    restore: (c) => set((s) => (s.items.some((x) => x.id === c.id) ? s : { items: [c, ...s.items] })),
  }), (s) => ({ items: s.items })),
);
