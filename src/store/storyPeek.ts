import { create } from 'zustand';

/** Anteprima tenendo premuto: chi sta guardando e di chi. Non si salva (vive solo mentre il dito è sul ventaglio). */
export const useStoryPeek = create<{ author: string | null; set: (a: string | null) => void }>((set) => ({ author: null, set: (author) => set({ author }) }));
