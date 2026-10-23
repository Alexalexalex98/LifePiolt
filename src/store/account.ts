import { create } from 'zustand';

import { persisted } from './persist';

/**
 * L'account di questa persona. 'none' = non ha ancora un account (modalità demo o primo avvio),
 * 'test' = account di prova creato senza server (nessun dato lascia il telefono, non vale per il social),
 * 'verified' = email confermata con il codice e profilo salvato sul server.
 * Dei dati anagrafici sul telefono resta solo l'essenziale: il resto sta sul server (vedi supabase/migrations/0005_account.sql).
 */
export type AccountStatus = 'none' | 'test' | 'verified';
type State = {
  status: AccountStatus;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  /** versione di Termini/Informativa accettata, e quando */
  acceptedVersion?: string;
  acceptedAt?: number;
  createdAt?: number;
  set: (p: Partial<Omit<State, 'set' | 'clear'>>) => void;
  clear: () => void;
};
const blank = { status: 'none' as AccountStatus, email: '', firstName: '', lastName: '', country: '', city: '' };

export const useAccount = create<State>()(
  persisted<State>('account', (set) => ({
    ...blank,
    set: (p) => set(p),
    clear: () => set({ ...blank, acceptedVersion: undefined, acceptedAt: undefined, createdAt: undefined }),
  }), undefined, { sensitive: true }),
);
