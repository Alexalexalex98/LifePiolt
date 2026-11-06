import { create } from 'zustand';

import type { Purchase } from '@/lib/warranty';

import { persisted } from './persist';

/** Garanzie: gli acquisti con i loro prodotti e il PDF della fattura. Solo sul telefono. */
type State = { items: Purchase[]; add: (p: Purchase) => void; update: (p: Purchase) => void; remove: (id: string) => void };
export const useWarranty = create<State>()(persisted<State>('warranty', (set) => ({
  items: [],
  add: (p) => set((s) => ({ items: [p, ...s.items.filter((x) => x.id !== p.id)] })),
  update: (p) => set((s) => ({ items: s.items.map((x) => (x.id === p.id ? p : x)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}), (s) => ({ items: s.items }), { sensitive: true }));
