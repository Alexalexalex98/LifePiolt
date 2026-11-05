import { create } from 'zustand';

import type { Course, Feedback, Objective, Result, Skill } from '@/lib/careerWork';
import { persisted } from './persist';

/** Carriera e crescita. Resta sul telefono: è la tua carriera, non la vede il datore di lavoro. */
type Data = { objectives: Objective[]; skills: Skill[]; courses: Course[]; results: Result[]; feedback: Feedback[]; answers: Record<string, string>; headline: string; summary: string; experience: string; contact: string };
type State = Data & {
  set: (p: Partial<Data>) => void;
  clear: () => void;
};
const empty: Data = { objectives: [], skills: [], courses: [], results: [], feedback: [], answers: {}, headline: '', summary: '', experience: '', contact: '' };
export const useCareer = create<State>()(persisted<State>('careerWork', (set) => ({ ...empty, set: (p) => set(p), clear: () => set({ ...empty }) }), (s) => ({ objectives: s.objectives, skills: s.skills, courses: s.courses, results: s.results, feedback: s.feedback, answers: s.answers, headline: s.headline, summary: s.summary, experience: s.experience, contact: s.contact }), { sensitive: true }));
export const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
