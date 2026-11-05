import { create } from 'zustand';

/** Notifiche di lavoro (spostamenti, annullamenti): stanno in memoria, la fonte è il server. */
export type TeamNotif = { id: string; team_id: string; user_id: string; kind: 'reschedule_ask' | 'reschedule_accepted' | 'reschedule_declined' | 'cancelled'; title: string; body: string; data: Record<string, unknown>; read: boolean; done: boolean; created_at: string };
type State = { items: TeamNotif[]; set: (items: TeamNotif[]) => void };
export const useTeamNotifs = create<State>()((set) => ({ items: [], set: (items) => set({ items }) }));
