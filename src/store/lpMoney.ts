import { create } from 'zustand';

import { addToGoal, roundUpOf, splitEqual, type Category, type Goal } from '@/lib/lpMoney';
import { useApp } from './app';
import { useChat } from './chat';
import { useNet } from './network';
import { persisted } from './persist';

export type Sub = { id: string; name: string; amount: number; /** giorno del mese */ day: number; ended?: boolean };
export type Request = { id: string; /** chi deve pagare */ who: string; amount: number; note: string; ts: number; status: 'open' | 'paid' };
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

type State = {
  budgets: Partial<Record<Category, number>>;
  goals: Goal[];
  /** obiettivo a cui vanno gli arrotondamenti delle spese */
  roundUpGoal: string | null;
  subs: Sub[];
  requests: Request[];
  setBudget: (c: Category, limit: number) => void;
  addGoal: (name: string, target: number) => void;
  removeGoal: (id: string) => void;
  /** LP messi da parte: restano nel saldo, servono a non spenderli per sbaglio */
  fundGoal: (id: string, amount: number) => void;
  setRoundUp: (id: string | null) => void;
  addSub: (name: string, amount: number, day: number) => void;
  endSub: (id: string) => void;
  /** chiede LP a una o più persone: arriva un messaggio in chat a ciascuna */
  request: (who: string[], amountEach: number[], note: string) => void;
  markPaid: (id: string) => void;
  reset: () => void;
};

export const useLpMoney = create<State>()(persisted<State>('lpmoney', (set) => ({
  budgets: {}, goals: [], roundUpGoal: null, subs: [], requests: [],
  setBudget: (c, limit) => set((s) => ({ budgets: { ...s.budgets, [c]: limit > 0 ? Math.round(limit) : undefined } })),
  addGoal: (name, target) => set((s) => ({ goals: [...s.goals, { id: uid('g'), name: name.trim().slice(0, 40), target: Math.max(1, Math.round(target)), saved: 0, createdAt: Date.now() }] })),
  removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id), roundUpGoal: s.roundUpGoal === id ? null : s.roundUpGoal })),
  fundGoal: (id, amount) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? addToGoal(g, amount) : g)) })),
  setRoundUp: (id) => set({ roundUpGoal: id }),
  addSub: (name, amount, day) => set((s) => ({ subs: [...s.subs, { id: uid('s'), name: name.trim().slice(0, 40), amount, day: Math.min(28, Math.max(1, Math.round(day))) }] })),
  endSub: (id) => set((s) => ({ subs: s.subs.map((x) => (x.id === id ? { ...x, ended: true } : x)) })),
  request: (who, amountEach, note) => {
    const me = useApp.getState().account.name;
    const chat = useChat.getState();
    const recs: Request[] = [];
    who.forEach((w, i) => {
      const amount = amountEach[i] ?? amountEach[0];
      recs.push({ id: uid('r'), who: w, amount, note, ts: Date.now(), status: 'open' });
      try { const cid = chat.ensureDm(w, me); chat.send(cid, me, { kind: 'text', text: `Ti chiedo ${amount} LP${note ? ` · ${note}` : ''}` }); } catch { /* la chat non è indispensabile */ }
    });
    set((s) => ({ requests: [...recs, ...s.requests].slice(0, 200) }));
  },
  markPaid: (id) => set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, status: 'paid' } : r)) })),
  reset: () => set({ budgets: {}, goals: [], roundUpGoal: null, subs: [], requests: [] }),
}), (s) => ({ budgets: s.budgets, goals: s.goals, roundUpGoal: s.roundUpGoal, subs: s.subs, requests: s.requests } as Partial<State>)));

/** Divide un importo tra più persone (chi paga compreso) e chiede a ciascuna la sua parte. */
export function splitBill(total: number, others: string[], note: string) {
  const parts = splitEqual(total, others.length + 1);
  useLpMoney.getState().request(others, parts.slice(1), note);
  return parts;
}

/* Arrotondamento: ogni spesa nuova mette nell'obiettivo scelto la differenza fino all'intero successivo. */
let seen = useNet.getState().lpMoves?.length ?? 0;
useNet.subscribe((s) => {
  const moves = s.lpMoves ?? [];
  if (moves.length <= seen) { seen = moves.length; return; }
  const fresh = moves.slice(seen);
  seen = moves.length;
  const { roundUpGoal, fundGoal } = useLpMoney.getState();
  if (!roundUpGoal) return;
  for (const m of fresh) if (m.kind === 'spend' && !/^(acquisto|vendita) [a-z.-]{1,6}$/i.test(m.label)) { const up = roundUpOf(m.amount); if (up > 0) fundGoal(roundUpGoal, up); }
});
