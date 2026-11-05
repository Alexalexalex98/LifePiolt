import { create } from 'zustand';

import type { ContractRead, Processing } from '@/lib/workLegal';

/** Legale e conformità del workspace. Solo in memoria: il server li dà solo a chi ha il permesso «contratti e documenti legali». */
export type LegalItem = { id: string; team_id: string; kind: 'contract' | 'processing' | 'check' | 'letter'; title: string; data: Record<string, unknown>; due: string | null; created_by: string; created_at: string; updated_at: string };
export type AuditRow = { id: number; team_id: string; user_id: string; action: 'creato' | 'modificato' | 'eliminato' | 'visto'; target: string; label: string; at: string };
export type LegalData = { items: LegalItem[]; audit: AuditRow[] };
const empty: LegalData = { items: [], audit: [] };
export const contractOf = (i: LegalItem) => i.data as unknown as ContractRead & { note?: string };
export const processingOf = (i: LegalItem) => i.data as unknown as Processing;
type State = { data: Record<string, LegalData>; set: (team: string, d: LegalData) => void };
export const useLegal = create<State>()((set) => ({ data: {}, set: (team, d) => set((s) => ({ data: { ...s.data, [team]: d } })) }));
export const legalOf = (team: string | undefined, data: Record<string, LegalData>): LegalData => (team ? data[team] : undefined) ?? empty;
