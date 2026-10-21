import { create } from 'zustand';

/** Quali video del feed sono davvero a vista: solo quelli partono. Prima ogni video già montato partiva da solo, anche fuori schermo. */
export const useFeedVisible = create<{ uris: Set<string>; set: (u: Set<string>) => void }>((set) => ({ uris: new Set(), set: (uris) => set({ uris }) }));
