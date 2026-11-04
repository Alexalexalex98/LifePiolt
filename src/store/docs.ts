import { create } from 'zustand';

import type { Access, DocKind } from '@/lib/docClassify';

/** Documenti di lavoro del workspace. Restano solo in memoria: i riservati (buste paga, CV, fatture) non vengono copiati sul telefono, li rilegge dal server chi ha il permesso. */
export type TeamDoc = {
  id: string; team_id: string; kind: DocKind; title: string; fields: Record<string, string>; access: Access; person: string | null;
  due: string | null; amount: number | null; currency: 'CHF' | 'EUR' | null; status: 'new' | 'paid' | 'done' | 'archived';
  path: string; file_name: string; mime: string | null; size: number; created_by: string; created_at: string;
};
type State = { docs: Record<string, TeamDoc[]>; set: (team: string, d: TeamDoc[]) => void; clear: () => void };
export const useDocs = create<State>()((set) => ({ docs: {}, set: (team, d) => set((s) => ({ docs: { ...s.docs, [team]: d } })), clear: () => set({ docs: {} }) }));
