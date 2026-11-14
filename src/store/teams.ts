import { create } from 'zustand';

import { persisted } from './persist';

/** Copia sul telefono dei team di cui fai parte (la verità è sul server). */
export type TeamInfo = { id: string; name: string; role: 'owner' | 'admin' | 'member'; members: number; /** workspace (predefinito) o gruppo di lavoro */ kind?: 'workspace' | 'group' };
type State = { teams: TeamInfo[]; /** i gruppi di lavoro, tenuti fuori dal Workspace */ groups: TeamInfo[]; syncedAt?: number; set: (p: Partial<Omit<State, 'set'>>) => void };
export const useTeams = create<State>()(persisted<State>('teams', (set) => ({ teams: [], groups: [], set: (p) => set(p) }), (s) => ({ teams: s.teams, groups: s.groups, syncedAt: s.syncedAt })));
