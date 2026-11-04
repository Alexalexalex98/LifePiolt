import { create } from 'zustand';

import type { Line, Meeting } from '@/lib/meetings';
import { persisted } from './persist';

/** Riunioni dei tuoi workspace (copia sul telefono: la verità è sul server). Le righe di trascrizione restano in memoria e si scaricano quando apri la riunione. */
type State = { items: Meeting[]; lines: Record<string, Line[]>; set: (p: Partial<Omit<State, 'set'>>) => void };
export const useMeetings = create<State>()(persisted<State>('meetings', (set) => ({ items: [], lines: {}, set: (p) => set(p) }), (s) => ({ items: s.items })));
