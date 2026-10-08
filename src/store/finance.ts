import { create } from 'zustand';

import { hashStr, mulberry32, monthLabelOf, uid, weekdayShortDate } from '@/lib/format';
import { persisted } from './persist';

export type Movement = { date: string; label: string; amount: number };
export type FinMonth = { label: string; start: number; locked: boolean; movements: Movement[] };
export type FinCategory = { n: string; p: number; c: string };
export type Insight = { id: number; title: string; detail: string; saving: string; dismissed: boolean };
export type Bill = { id: string; name: string; amount: number; freq: 'monthly' | 'yearly' };
export type Budget = { salary: number; saveToEmergency: boolean; alloc: Record<string, number> };
export type TaxDocFile = { name: string; uri: string; size?: number; mime?: string; checkedAt: string; status: 'ok' | 'dubbio' };
/** docs: un valore booleano (dati vecchi) non vale come caricato: va ricaricato il file. */
export type TaxDecl = { married: boolean; children: boolean; banks: string[]; docs: Record<string, TaxDocFile> };
/** Restituisce il file confermato per un documento, ignorando i vecchi valori booleani. */
export function taxDocOf(docs: Record<string, unknown>, k: string): TaxDocFile | undefined {
  const v = docs?.[k] as Partial<TaxDocFile> | boolean | undefined;
  return v && typeof v === 'object' && typeof v.uri === 'string' && typeof v.name === 'string' ? (v as TaxDocFile) : undefined;
}
export type Stock = {
  symbol: string; name: string; history: number[]; price: number; changeAbs: number; changePct: number; open: number;
  high52: number; low52: number; vol: string; mcap: string; pe: string; shares: number; avgCost: number;
};
export type PendingOrder = { id: string; symbol: string; type: 'buy' | 'sell'; limitPrice: number; amount: number; date: string; sl: number | null; tp: number | null };
export type Trade = { id: string; symbol: string; type: 'buy' | 'sell'; shares: number; price: number; amount: number; date: string };

export const defaultCategories: FinCategory[] = [
  { n: 'Affitto', p: 40, c: '#5b8def' }, { n: 'Fondo emergenza', p: 10, c: '#7c5cff' }, { n: 'Alimentari/Casa', p: 8, c: '#4fd18b' },
  { n: 'Cassa malati', p: 12, c: '#ff6f91' }, { n: 'Abbigliamento', p: 5, c: '#b96bff' }, { n: 'Viaggio estero', p: 8, c: '#4fc7e0' },
  { n: 'Abbonamenti', p: 2.5, c: '#c9d15c' }, { n: 'Altro', p: 14.5, c: '#ffb84f' },
];
export const defaultGuidelines: Record<string, number> = { Affitto: 30, 'Fondo emergenza': 10, 'Alimentari/Casa': 12, 'Cassa malati': 10, Abbigliamento: 5, 'Viaggio estero': 5, Abbonamenti: 3, Altro: 15 };

/** Categoria di budget di un movimento: nome esatto, "Categoria · dettaglio", parole chiave note, altrimenti "Altro". */
export function categoryOf(label: string, cats: FinCategory[] = defaultCategories): string {
  const l = label.trim().toLowerCase();
  const hit = cats.find((c) => l === c.n.toLowerCase() || l.startsWith(c.n.toLowerCase() + ' ·') || l.startsWith(c.n.toLowerCase() + ' -'));
  if (hit) return hit.n;
  const kw: [RegExp, string][] = [
    [/affitto|pigione|locazione/, 'Affitto'], [/cassa malati|assicurazione sanitaria|franchigia/, 'Cassa malati'],
    [/fondo emergenza|emergenza/, 'Fondo emergenza'], [/spesa|coop|migros|aldi|lidl|denner|supermercat|elettricit|internet|bolletta|casa/, 'Alimentari/Casa'],
    [/abbigliament|scarpe|vestit|zara|h&m/, 'Abbigliamento'], [/viaggio|volo|hotel|vacanz/, 'Viaggio estero'], [/abbonament|netflix|spotify|palestra|disney|sbb/, 'Abbonamenti'],
  ];
  const k = kw.find(([re]) => re.test(l));
  return k && cats.some((c) => c.n === k[1]) ? k[1] : 'Altro';
}
/** Spesa (positiva) per categoria in uno o più mesi. */
export function spendByCategory(months: FinMonth[], cats: FinCategory[]): Record<string, number> {
  const out: Record<string, number> = {};
  months.forEach((m) => m.movements.forEach((x) => {
    if (x.amount >= 0) return;
    const c = categoryOf(x.label, cats);
    out[c] = (out[c] ?? 0) - x.amount;
  }));
  return out;
}

/** Costi normali di una persona sola in Svizzera (CHF): proposti da "Aggiungi costi tipici". */
export const typicalCosts: Omit<Bill, 'id'>[] = [
  { name: 'Affitto', amount: 1400, freq: 'monthly' }, { name: 'Cassa malati', amount: 385, freq: 'monthly' },
  { name: 'Elettricità', amount: 62, freq: 'monthly' }, { name: 'Internet e telefono', amount: 79, freq: 'monthly' },
  { name: 'Assicurazione RC e economia domestica', amount: 190, freq: 'yearly' }, { name: 'Serafe (canone radio-TV)', amount: 335, freq: 'yearly' },
  { name: 'Abbonamento trasporti', amount: 85, freq: 'monthly' }, { name: 'Palestra', amount: 69, freq: 'monthly' },
  { name: 'Netflix', amount: 15.9, freq: 'monthly' }, { name: 'Spotify', amount: 12.95, freq: 'monthly' },
  { name: 'Imposte accantonate', amount: 420, freq: 'monthly' }, { name: 'Benzina o trasporti', amount: 120, freq: 'monthly' },
];
export const normBill = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

export const monthNet = (m: FinMonth) => m.movements.reduce((s, x) => s + x.amount, 0);
export const monthEnd = (m: FinMonth) => m.start + monthNet(m);
export const avgRecentNet = (months: FinMonth[]) => {
  const last = months.slice(0, 3);
  return last.length ? last.reduce((s, m) => s + monthNet(m), 0) / last.length : 0;
};
export const emergencyByMonth = (m: FinMonth) => m.movements.filter((x) => x.label.toLowerCase().includes('fondo emergenza')).reduce((s, x) => s + Math.abs(x.amount), 0);

export function defaultBudget(salary: number, saveEF: boolean, cats: FinCategory[], months: FinMonth[]): Budget {
  const buffer = avgRecentNet(months);
  const allocatable = Math.max(0, salary - buffer);
  const alloc: Record<string, number> = {};
  cats.forEach((c) => { alloc[c.n] = c.n === 'Fondo emergenza' && !saveEF ? 0 : Math.round((allocatable * c.p) / 100); });
  return { salary, saveToEmergency: saveEF, alloc };
}

export function genHistory(symbol: string, base: number, n: number): number[] {
  const rng = mulberry32(hashStr(symbol));
  const pts = [base];
  for (let i = 1; i < n; i++) pts.push(Math.max(1, pts[i - 1] + (rng() - 0.48) * base * 0.02));
  return pts;
}
export function makeStock(symbol: string, name: string, base: number, mcap: string, pe: string, shares = 0, avgCost = 0): Stock {
  const hist = genHistory(symbol, base, 60);
  const price = hist[hist.length - 1], prev = hist[hist.length - 2];
  const changeAbs = price - prev;
  return {
    symbol, name, history: hist, price, changeAbs, changePct: prev ? (changeAbs / prev) * 100 : 0, open: prev,
    high52: Math.max(...hist) * 1.03, low52: Math.min(...hist) * 0.97,
    vol: Math.round(mulberry32(hashStr(symbol + 'v'))() * 40 + 5) + 'M', mcap, pe, shares, avgCost,
  };
}
export const defaultWatchlist = (holdings: boolean): Stock[] => [
  makeStock('AAPL', 'Apple Inc.', 228, '3.48T', '31.2', holdings ? 15 : 0, holdings ? 195 : 0),
  makeStock('TSLA', 'Tesla Inc.', 255, '820B', '68.4'),
  makeStock('MSFT', 'Microsoft Corp.', 430, '3.19T', '35.7', holdings ? 8 : 0, holdings ? 380 : 0),
  makeStock('NVDA', 'NVIDIA Corp.', 178, '4.35T', '48.1', holdings ? 25 : 0, holdings ? 120 : 0),
  makeStock('UBSG', 'UBS Group AG', 31, '112B', '13.8', holdings ? 200 : 0, holdings ? 27 : 0),
  makeStock('NESN', 'Nestlé SA', 88, '237B', '19.5'),
];

type FinState = {
  categories: FinCategory[];
  insights: Insight[];
  savingsPct: number;
  months: FinMonth[];
  budget: Budget;
  guidelines: Record<string, number>;
  bills: Bill[];
  tax: TaxDecl;
  stocks: Stock[];
  cash: number;
  orders: PendingOrder[];
  trades: Trade[];
  plans: Record<string, { amount: number; freq: 'mensile' | 'settimanale' }>;

  addMovement: (idx: number, mv: Movement) => void;
  delMovement: (idx: number, mi: number) => void;
  dismissInsight: (id: number, v: boolean) => void;
  setBudget: (b: Partial<Budget>) => void;
  setAlloc: (name: string, v: number) => void;
  resetBudget: () => void;
  setGuidelineSalary: (v: number) => void;
  addBill: (b: Omit<Bill, 'id'>) => void;
  delBill: (id: string) => void;
  /** Aggiunge più bollette in un colpo, saltando i nomi già presenti. Restituisce quante ne ha aggiunte. */
  addBills: (list: Omit<Bill, 'id'>[]) => number;
  setTax: (p: Partial<TaxDecl>) => void;
  setTaxDoc: (k: string, f: TaxDocFile | null) => void;
  rollMonth: () => void;

  addStock: (symbol: string, name: string) => void;
  delStock: (symbol: string) => void;
  buy: (symbol: string, amt: number) => string;
  sell: (symbol: string, amt: number) => string;
  placeLimit: (o: Omit<PendingOrder, 'id' | 'date'>) => void;
  executeOrder: (id: string) => string | null;
  cancelOrder: (id: string) => void;
  addCash: (v: number) => void;
  setPlan: (symbol: string, p: { amount: number; freq: 'mensile' | 'settimanale' } | null) => void;
  reset: () => void;
};

const startMonthLabel = () => monthLabelOf(new Date());
const blank = () => ({
  categories: defaultCategories,
  insights: [] as Insight[],
  savingsPct: 0,
  months: [{ label: startMonthLabel(), start: 0, locked: false, movements: [] }] as FinMonth[],
  budget: { salary: 0, saveToEmergency: true, alloc: {} } as Budget,
  guidelines: defaultGuidelines,
  bills: [] as Bill[],
  tax: { married: false, children: false, banks: [], docs: {} } as TaxDecl,
  stocks: defaultWatchlist(false),
  cash: 0,
  orders: [] as PendingOrder[],
  trades: [] as Trade[],
  plans: {} as FinState['plans'],
});

export const useFin = create<FinState>()(
  persisted<FinState>('finance', (set, get) => ({
    ...blank(),

    addMovement: (idx, mv) => set((s) => ({ months: s.months.map((m, i) => (i === idx ? { ...m, movements: [...m.movements, mv] } : m)) })),
    delMovement: (idx, mi) => set((s) => ({ months: s.months.map((m, i) => (i === idx ? { ...m, movements: m.movements.filter((_, j) => j !== mi) } : m)) })),
    dismissInsight: (id, v) => set((s) => ({ insights: s.insights.map((i) => (i.id === id ? { ...i, dismissed: v } : i)) })),
    setBudget: (b) => set((s) => ({ budget: { ...s.budget, ...b } })),
    setAlloc: (name, v) => set((s) => ({ budget: { ...s.budget, alloc: { ...s.budget.alloc, [name]: v } } })),
    resetBudget: () => set((s) => ({ budget: defaultBudget(s.budget.salary || 6500, s.budget.saveToEmergency, s.categories, s.months) })),
    setGuidelineSalary: (v) => set((s) => ({ budget: { ...s.budget, salary: v } })),
    addBill: (b) => set((s) => ({ bills: [...s.bills, { id: uid(), ...b }] })),
    addBills: (list) => {
      const have = new Set(get().bills.map((b) => normBill(b.name)));
      const add = list.filter((b) => { const k = normBill(b.name); if (!k || have.has(k)) return false; have.add(k); return true; });
      if (add.length) set((s) => ({ bills: [...s.bills, ...add.map((b) => ({ id: uid(), ...b }))] }));
      return add.length;
    },
    delBill: (id) => set((s) => ({ bills: s.bills.filter((b) => b.id !== id) })),
    setTax: (p) => set((s) => ({ tax: { ...s.tax, ...p } })),
    setTaxDoc: (k, f) => set((s) => {
      const docs = { ...s.tax.docs };
      if (f) docs[k] = f; else delete docs[k];
      return { tax: { ...s.tax, docs } };
    }),

    /** Se è iniziato un nuovo mese, blocca quello precedente e ne apre uno nuovo. */
    rollMonth: () => {
      const months = get().months;
      const cur = startMonthLabel();
      if (months.some((m) => m.label === cur)) return;
      const prev = months[0];
      set({ months: [{ label: cur, start: prev ? monthEnd(prev) : 0, locked: false, movements: [] }, ...months.map((m, i) => (i === 0 ? { ...m, locked: true } : m))] });
    },

    addStock: (symbol, name) => set((s) => ({ stocks: [...s.stocks, makeStock(symbol, name, Math.round(50 + Math.random() * 300), '—', '—')] })),
    delStock: (symbol) => set((s) => ({ stocks: s.stocks.filter((x) => x.symbol !== symbol) })),
    buy: (symbol, amt) => {
      const st = get().stocks.find((x) => x.symbol === symbol);
      if (!st) return '';
      if (amt > get().cash) return 'Fondi disponibili insufficienti';
      const ns = amt / st.price;
      set((s) => ({
        stocks: s.stocks.map((x) => (x.symbol !== symbol ? x : { ...x, avgCost: x.shares > 0 ? (x.avgCost * x.shares + amt) / (x.shares + ns) : x.price, shares: x.shares + ns })),
        cash: s.cash - amt,
        trades: [...s.trades, { id: uid(), symbol, type: 'buy', shares: ns, price: st.price, amount: amt, date: weekdayShortDate() }],
      }));
      return `Acquistate ${ns.toFixed(3)} azioni ${symbol}`;
    },
    sell: (symbol, amt) => {
      const st = get().stocks.find((x) => x.symbol === symbol);
      if (!st || st.shares <= 0) return 'Nessuna posizione da vendere';
      amt = Math.min(amt, st.shares * st.price);
      const sold = amt / st.price;
      set((s) => ({
        stocks: s.stocks.map((x) => (x.symbol !== symbol ? x : { ...x, shares: x.shares - sold < 0.0001 ? 0 : x.shares - sold })),
        cash: s.cash + amt,
        trades: [...s.trades, { id: uid(), symbol, type: 'sell', shares: sold, price: st.price, amount: amt, date: weekdayShortDate() }],
      }));
      return `Vendute ${sold.toFixed(3)} azioni ${symbol}`;
    },
    placeLimit: (o) => set((s) => ({ orders: [...s.orders, { id: uid(), date: weekdayShortDate(), ...o }] })),
    executeOrder: (id) => {
      const o = get().orders.find((x) => x.id === id);
      if (!o) return null;
      set((s) => ({ orders: s.orders.filter((x) => x.id !== id) }));
      return o.type === 'buy' ? get().buy(o.symbol, o.amount) : get().sell(o.symbol, o.amount);
    },
    cancelOrder: (id) => set((s) => ({ orders: s.orders.filter((x) => x.id !== id) })),
    addCash: (v) => set((s) => ({ cash: s.cash + v })),
    setPlan: (symbol, p) => set((s) => { const plans = { ...s.plans }; if (p) plans[symbol] = p; else delete plans[symbol]; return { plans }; }),
    reset: () => set({ ...blank() }),
  })),
);

export const holdings = (stocks: Stock[]) => stocks.filter((s) => s.shares > 0);
