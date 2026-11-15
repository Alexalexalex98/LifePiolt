import { create } from 'zustand';

import { defaultContract, type Contract, type Day, type Payslip } from '@/lib/payroll';

import { persisted } from './persist';

/** Ore e stipendio: il contratto, le giornate (confermate o previste) e le buste paga. Solo sul telefono, cifrati. */
type State = {
  contract: Contract;
  /** il contratto è stato compilato almeno una volta */
  ready: boolean;
  days: Record<string, Day>;
  slips: Payslip[];
  setContract: (c: Contract) => void;
  attachContractFile: (pdf: string | undefined, pages: string[] | undefined) => void;
  setDay: (d: Day) => void;
  setDays: (ds: Day[]) => void;
  removeDay: (date: string) => void;
  confirm: (dates: string[]) => void;
  addSlip: (p: Payslip) => void;
  updateSlip: (p: Payslip) => void;
  removeSlip: (id: string) => void;
};
export const usePayroll = create<State>()(persisted<State>('payroll', (set) => ({
  contract: defaultContract(), ready: false, days: {}, slips: [],
  setContract: (c) => set({ contract: c, ready: true }),
  attachContractFile: (pdf, pages) => set((s) => ({ contract: { ...s.contract, pdf, pages } })),
  setDay: (d) => set((s) => ({ days: { ...s.days, [d.date]: d } })),
  setDays: (ds) => set((s) => ({ days: { ...s.days, ...Object.fromEntries(ds.map((d) => [d.date, d])) } })),
  removeDay: (date) => set((s) => { const days = { ...s.days }; delete days[date]; return { days }; }),
  confirm: (dates) => set((s) => { const days = { ...s.days }; for (const k of dates) if (days[k]) days[k] = { ...days[k]!, confirmed: true }; return { days }; }),
  addSlip: (p) => set((s) => ({ slips: [p, ...s.slips.filter((x) => x.id !== p.id)] })),
  updateSlip: (p) => set((s) => ({ slips: s.slips.map((x) => (x.id === p.id ? p : x)) })),
  removeSlip: (id) => set((s) => ({ slips: s.slips.filter((x) => x.id !== id) })),
}), (s) => ({ contract: s.contract, ready: s.ready, days: s.days, slips: s.slips }), { sensitive: true }));
