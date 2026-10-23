import { create } from 'zustand';

import type { Friend } from '@/lib/friendsCore';

import { persisted } from './persist';

/** Amici veri (dal server) e cosa è già stato scambiato: restano sul telefono. I messaggi stanno nelle chat di sempre. */
type State = {
  friends: Friend[];
  code: string;
  /** data dell'ultimo messaggio scaricato (ISO) */
  cursor: string;
  /** messaggi del server già gestiti e messaggi miei già mandati (ultimi 3000) */
  seen: string[];
  sent: string[];
  set: (p: Partial<Pick<State, 'friends' | 'code' | 'cursor' | 'seen' | 'sent'>>) => void;
  reset: () => void;
};
const blank = { friends: [] as Friend[], code: '', cursor: '', seen: [] as string[], sent: [] as string[] };
export const useFriends = create<State>()(persisted<State>('friends', (set) => ({ ...blank, set: (p) => set(p), reset: () => set({ ...blank }) })));
