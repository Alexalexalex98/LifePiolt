import { create } from 'zustand';

import type { WTask } from '@/lib/workTasks';

/** Task e progetti di lavoro dei tuoi workspace (solo in memoria: li rilegge il server, che decide chi vede che cosa). */
export type WProject = { id: string; team_id: string; goal: string; due: string | null; status: 'active' | 'paused' | 'done'; created_by: string };
type State = { tasks: Record<string, WTask[]>; projects: Record<string, WProject[]>; setTasks: (team: string, t: WTask[]) => void; setProjects: (team: string, p: WProject[]) => void };
export const useWTasks = create<State>()((set) => ({
  tasks: {}, projects: {},
  setTasks: (team, t) => set((s) => ({ tasks: { ...s.tasks, [team]: t } })),
  setProjects: (team, p) => set((s) => ({ projects: { ...s.projects, [team]: p } })),
}));
