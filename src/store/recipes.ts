import { create } from 'zustand';

import type { Diet } from '@/lib/recipes/book';

import { persisted } from './persist';

export type KTimer = { id: string; recipeId?: string; label: string; sec: number; endAt: number; fired?: boolean };
export type Cooking = { recipeId: string; servings: number; step: number; startedAt: number; checked: string[] };
type State = {
  favs: string[];
  notes: Record<string, string>;
  cooked: Record<string, { n: number; last: number; stars?: number }>;
  /** le diete e le intolleranze della persona: le ricette che non le rispettano vengono segnalate */
  myDiets: Diet[];
  timers: KTimer[];
  cooking: Cooking | null;
  toggleFav: (id: string) => void;
  setNote: (id: string, text: string) => void;
  markCooked: (id: string, stars?: number) => void;
  setDiets: (d: Diet[]) => void;
  addTimer: (t: KTimer) => void;
  patchTimer: (id: string, p: Partial<KTimer>) => void;
  removeTimer: (id: string) => void;
  clearTimers: (recipeId?: string) => void;
  startCooking: (c: Cooking) => void;
  patchCooking: (p: Partial<Cooking>) => void;
  stopCooking: () => void;
};

export const useRecipes = create<State>()(
  persisted<State>('recipes', (set) => ({
    favs: [], notes: {}, cooked: {}, myDiets: [], timers: [], cooking: null,
    toggleFav: (id) => set((s) => ({ favs: s.favs.includes(id) ? s.favs.filter((x) => x !== id) : [id, ...s.favs] })),
    setNote: (id, text) => set((s) => { const notes = { ...s.notes }; if (text.trim()) notes[id] = text; else delete notes[id]; return { notes }; }),
    markCooked: (id, stars) => set((s) => ({ cooked: { ...s.cooked, [id]: { n: (s.cooked[id]?.n ?? 0) + 1, last: Date.now(), stars: stars ?? s.cooked[id]?.stars } } })),
    setDiets: (d) => set({ myDiets: d }),
    addTimer: (t) => set((s) => ({ timers: [...s.timers.filter((x) => x.id !== t.id), t] })),
    patchTimer: (id, p) => set((s) => ({ timers: s.timers.map((t) => (t.id === id ? { ...t, ...p } : t)) })),
    removeTimer: (id) => set((s) => ({ timers: s.timers.filter((t) => t.id !== id) })),
    clearTimers: (recipeId) => set((s) => ({ timers: recipeId ? s.timers.filter((t) => t.recipeId !== recipeId) : [] })),
    startCooking: (c) => set({ cooking: c }),
    patchCooking: (p) => set((s) => (s.cooking ? { cooking: { ...s.cooking, ...p } } : s)),
    stopCooking: () => set({ cooking: null }),
  }), (s) => ({ favs: s.favs, notes: s.notes, cooked: s.cooked, myDiets: s.myDiets, timers: s.timers, cooking: s.cooking })),
);
