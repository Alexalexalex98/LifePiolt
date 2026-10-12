import { create } from 'zustand';

import { normalizeEntries, pushCapped, removeMatching, type PrivacyEntry, type PrivacyFilter } from '@/lib/privacyLog';
import { persisted } from './persist';

/** Registro di uscita ("Cosa è uscito dal tuo telefono"): solo metadati, mai contenuto. Tetto 2000 righe. */
type State = {
  entries: PrivacyEntry[];
  add: (e: PrivacyEntry) => void;
  /** elimina le righe che corrispondono al filtro (vuoto = tutte); restituisce quelle tolte per l'annulla */
  remove: (f: PrivacyFilter) => PrivacyEntry[];
  restore: (list: PrivacyEntry[]) => void;
  reset: () => void;
};

export const usePrivacyLog = create<State>()(
  persisted<State>('privacyLog', (set, get) => ({
    entries: [],
    add: (e) => set((s) => ({ entries: pushCapped(s.entries, e) })),
    remove: (f) => {
      const before = get().entries;
      const after = removeMatching(before, f);
      set({ entries: after });
      const gone = new Set(after.map((x) => x.id));
      return before.filter((x) => !gone.has(x.id));
    },
    restore: (list) => set((s) => ({ entries: normalizeEntries([...s.entries, ...list].sort((a, b) => b.ts - a.ts)) })),
    reset: () => set({ entries: [] }),
  }), (s) => ({ entries: s.entries }) as State),
);
