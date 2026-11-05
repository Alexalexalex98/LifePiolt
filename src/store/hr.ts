import { create } from 'zustand';

import type { AbsenceRow, Cand, Profile, Training } from '@/lib/hr';

/** Persone e HR del workspace. Solo in memoria: sono dati personali e il server li dà solo a chi ha il permesso. */
export type HrProfile = Profile & { team_id: string; user_id: string };
export type HrCandidate = Cand & { team_id: string; email: string; phone: string; source: string; notes: string; cv_doc: string | null };
export type HrReview = { id: string; team_id: string; person: string; period: string; goals: { t: string; done: boolean }[]; rating: number | null; feedback: string; status: 'draft' | 'shared'; by: string };
export type HrTraining = Training & { team_id: string; person: string };
export type HrData = { profiles: HrProfile[]; mine: Profile | null; candidates: HrCandidate[]; reviews: HrReview[]; training: HrTraining[]; absences: (AbsenceRow & { id: string })[] };
const empty: HrData = { profiles: [], mine: null, candidates: [], reviews: [], training: [], absences: [] };
type State = { data: Record<string, HrData>; set: (team: string, d: HrData) => void };
export const useHr = create<State>()((set) => ({ data: {}, set: (team, d) => set((s) => ({ data: { ...s.data, [team]: d } })) }));
export const hrOf = (team: string | undefined, all: Record<string, HrData>): HrData => (team && all[team]) || empty;
