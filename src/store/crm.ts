import { create } from 'zustand';

import type { Contact, Deal, Interaction, Receivable, Ticket } from '@/lib/crm';

/** Clienti, trattative e assistenza dei tuoi workspace. Solo in memoria: i dati dei clienti non restano sul telefono, li rilegge il server a chi ha il permesso. */
export type CrmData = { contacts: Contact[]; interactions: Interaction[]; deals: Deal[]; tickets: Ticket[]; receivables: Receivable[] };
const empty: CrmData = { contacts: [], interactions: [], deals: [], tickets: [], receivables: [] };
type State = { data: Record<string, CrmData>; set: (team: string, d: CrmData) => void };
export const useCrm = create<State>()((set) => ({ data: {}, set: (team, d) => set((s) => ({ data: { ...s.data, [team]: d } })) }));
export const crmOf = (team: string | undefined, all: Record<string, CrmData>): CrmData => (team && all[team]) || empty;
