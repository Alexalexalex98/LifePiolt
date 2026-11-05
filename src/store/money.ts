import { create } from 'zustand';

import type { Budget, Entry, Expense, Sub } from '@/lib/money';

/** Soldi del workspace: prima nota, note spese, budget, abbonamenti. Solo in memoria: li rilegge il server a chi ha il permesso. */
export type MoneyData = { entries: Entry[]; expenses: Expense[]; budgets: Budget[]; subs: Sub[] };
const empty: MoneyData = { entries: [], expenses: [], budgets: [], subs: [] };
type State = { data: Record<string, MoneyData>; set: (team: string, d: MoneyData) => void };
export const useMoney = create<State>()((set) => ({ data: {}, set: (team, d) => set((s) => ({ data: { ...s.data, [team]: d } })) }));
export const moneyOf = (team: string | undefined, all: Record<string, MoneyData>): MoneyData => (team && all[team]) || empty;
