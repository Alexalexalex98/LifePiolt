import { create } from 'zustand';

import { persisted } from './persist';

/** Copia sul telefono dei team di cui fai parte (la verità è sul server). */
export type TeamInfo = { id: string; name: string; role: 'owner' | 'admin' | 'member'; members: number };
type State = { teams: TeamInfo[]; syncedAt?: number; set: (p: Partial<Omit<State, 'set'>>) => void };
export const useTeams = create<State>()(persisted<State>('teams', (set) => ({ teams: [], set: (p) => set(p) }), (s) => ({ teams: s.teams, syncedAt: s.syncedAt })));
