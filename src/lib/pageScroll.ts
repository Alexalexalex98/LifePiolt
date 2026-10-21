import { create } from 'zustand';

/** Blocca lo scorrimento della pagina mentre trascini un widget (altrimenti la pagina "ruba" il gesto) e permette di scorrerla da codice. */
export const useScrollLock = create<{ locked: boolean; set: (v: boolean) => void }>((set) => ({ locked: false, set: (locked) => set({ locked }) }));
export const pageScroll: { y: number; scrollTo: (y: number) => void } = { y: 0, scrollTo: () => undefined };
