import { create } from 'zustand';

import { give, newPet, tick, type Earned, type Kind, type PetPublic, type PetState } from '@/lib/pet';
import type { Fx } from '@/lib/petFood';

import { persisted } from './persist';

/** Theia da accudire: stato salvato sul telefono. Le necessità si aggiornano con l'ora quando si apre. */
type State = {
  pet: PetState;
  /** Theia degli altri utenti (solo di chi ha scelto di mostrarla): qui arrivano dalla rete; in demo sono esempi */
  others: Record<string, PetPublic & { demo?: boolean }>;
  /** ultima visita a ogni amico (giorno): i punti per la visita si danno una volta al giorno */
  visits: Record<string, string>;
  visit: (name: string, day: string) => boolean;
  refresh: () => void;
  giveTo: (kind: Kind, earned: Earned, day: string, fx?: Fx) => { ok: boolean; leveledUp: boolean };
  /** punti per aver fatto un'attività insieme (esplorazione, non cura) */
  addXp: (n: number) => void;
  rename: (name: string) => void;
  setShare: (v: boolean) => void;
  setOthers: (o: State['others']) => void;
};

export const usePet = create<State>()(
  persisted<State>('pet', (set, get) => ({
    pet: newPet(),
    others: {},
    visits: {},
    visit: (name, day) => { if (get().visits[name] === day) return false; set((s) => ({ visits: { ...s.visits, [name]: day }, pet: { ...s.pet, xp: s.pet.xp + 2 } })); return true; },
    refresh: () => set((s) => ({ pet: tick(s.pet) })),
    giveTo: (kind, earned, day, fx) => { const r = give(get().pet, kind, earned, day, Date.now(), fx); if (r.ok) set({ pet: r.pet }); else set({ pet: r.pet }); return { ok: r.ok, leveledUp: r.leveledUp }; },
    addXp: (n) => set((s) => ({ pet: { ...s.pet, xp: s.pet.xp + n } })),
    rename: (name) => set((s) => ({ pet: { ...s.pet, name: name.trim().slice(0, 20) || 'Theia' } })),
    setShare: (share) => set((s) => ({ pet: { ...s.pet, share } })),
    setOthers: (others) => set({ others }),
  })),
);
