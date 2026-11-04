import { create } from 'zustand';

import { DEFAULT_SCHEDULE, type Schedule } from '@/lib/workHours';
import type { PlanFilter } from '@/lib/workPlan';
import { persisted } from './persist';

/** Lavoro: l'orario di ogni workspace (copia locale, la verità è sul server), il filtro del Plan e il workspace attivo. */
export type Absence = { id: string; team_id: string; user_id: string; kind: 'ferie' | 'permesso' | 'malattia' | 'altro'; from_day: string; to_day: string; note?: string | null; status: 'requested' | 'approved' | 'rejected' };
type State = {
  schedules: Record<string, Schedule>;
  filter: PlanFilter;
  active?: string;
  set: (p: Partial<Omit<State, 'set'>>) => void;
};
export const useWork = create<State>()(persisted<State>('work', (set) => ({ schedules: {}, filter: 'all', set: (p) => set(p) }), (s) => ({ schedules: s.schedules, filter: s.filter, active: s.active })));
export const scheduleOf = (team: string | undefined, all: Record<string, Schedule>): Schedule => (team && all[team]) || DEFAULT_SCHEDULE;
