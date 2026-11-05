import { create } from 'zustand';

import { persisted } from './persist';

/** Come guardi i task: chi, come e quale progetto. */
type State = { filter: 'mine' | 'all' | 'late'; view: 'list' | 'kanban' | 'cal'; project: string | null; set: (p: Partial<Omit<State, 'set'>>) => void };
export const useTasks = create<State>()(persisted<State>('tasksView', (set) => ({ filter: 'mine', view: 'list', project: null, set: (p) => set(p) }), (s) => ({ filter: s.filter, view: s.view })));
