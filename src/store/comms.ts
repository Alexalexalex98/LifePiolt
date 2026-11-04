import { create } from 'zustand';

import { persisted } from './persist';

/** Messaggi di lavoro (copia sul telefono degli ultimi di ogni canale: la verità è sul server), assenze e «aspetto risposta». */
export type Msg = { id: number; team_id: string; channel: string; author: string; text: string; reply_to: number | null; mentions: string[]; pinned: boolean; created_at: string };
export type Away = { until: string; message: string };
export type Waiting = { id: string; team: string; msg: number; text: string; from: string; due: string; done?: boolean };
type State = {
  msgs: Record<string, Msg[]>;                        // chiave: «team|canale»
  away: Record<string, Record<string, Away>>;         // team -> persona -> assenza
  waiting: Waiting[];
  seen: Record<string, number>;                       // ultimo messaggio letto per canale
  set: (p: Partial<Omit<State, 'set'>>) => void;
};
export const chanKey = (team: string, channel: string) => `${team}|${channel}`;
export const useComms = create<State>()(persisted<State>('comms', (set) => ({ msgs: {}, away: {}, waiting: [], seen: {}, set: (p) => set(p) }), (s) => ({ msgs: Object.fromEntries(Object.entries(s.msgs).map(([k, v]) => [k, v.slice(-50)])), away: s.away, waiting: s.waiting, seen: s.seen })));
