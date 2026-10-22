import { create } from 'zustand';

import type { IncomeModel, PaymentPlan, SaveGoal } from '@/lib/monthPlan';

import { persisted } from './persist';

export type ExtraFixed = { id: string; name: string; amount: number };
/** Piano del mese: entrata prevista, spese fisse aggiunte a mano, obiettivi di risparmio, dilazioni di fatture grosse e risposte dell'utente alle domande. */
type State = {
  income: IncomeModel | null;
  extraFixed: ExtraFixed[];
  goals: SaveGoal[];
  plans: PaymentPlan[];
  /** dove mettere da parte i soldi (nome del conto o «in contanti») */
  savingsAccount: string;
  answers: Record<string, string>;
  setIncome: (m: IncomeModel | null) => void;
  patchIncome: (p: Partial<IncomeModel>) => void;
  addExtraFixed: (name: string, amount: number) => void;
  patchExtraFixed: (id: string, p: Partial<ExtraFixed>) => void;
  delExtraFixed: (id: string) => void;
  addGoal: (g: Omit<SaveGoal, 'id'>) => string;
  patchGoal: (id: string, p: Partial<SaveGoal>) => void;
  delGoal: (id: string) => void;
  addPlan: (p: Omit<PaymentPlan, 'id'>) => string;
  delPlan: (id: string) => void;
  setSavingsAccount: (s: string) => void;
  answer: (id: string, a: string) => void;
};

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useMonthPlan = create<State>()(
  persisted<State>('monthPlan', (set) => ({
    income: null,
    extraFixed: [],
    goals: [],
    plans: [],
    savingsAccount: '',
    answers: {},
    setIncome: (income) => set({ income }),
    patchIncome: (p) => set((s) => ({ income: { mode: 'fixed', ...(s.income ?? {}), ...p } as IncomeModel })),
    addExtraFixed: (name, amount) => set((s) => ({ extraFixed: [...s.extraFixed, { id: uid(), name, amount }] })),
    patchExtraFixed: (id, p) => set((s) => ({ extraFixed: s.extraFixed.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    delExtraFixed: (id) => set((s) => ({ extraFixed: s.extraFixed.filter((x) => x.id !== id) })),
    addGoal: (g) => { const id = uid(); set((s) => ({ goals: [...s.goals, { ...g, id }] })); return id; },
    patchGoal: (id, p) => set((s) => ({ goals: s.goals.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
    delGoal: (id) => set((s) => ({ goals: s.goals.filter((x) => x.id !== id) })),
    addPlan: (p) => { const id = uid(); set((s) => ({ plans: [...s.plans, { ...p, id }] })); return id; },
    delPlan: (id) => set((s) => ({ plans: s.plans.filter((x) => x.id !== id) })),
    setSavingsAccount: (savingsAccount) => set({ savingsAccount }),
    answer: (id, a) => set((s) => ({ answers: { ...s.answers, [id]: a } })),
  })),
);
