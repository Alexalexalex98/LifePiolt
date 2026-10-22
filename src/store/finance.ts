import { analyzeStatement, DEFAULT_AVG, DEFAULT_RULE, type Analysis, type AvgRule, type SalaryRule } from '@/lib/statementAnalysis';
import { listMovements } from '@/lib/explain';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { nextOccurrence } from '@/lib/bills/plan';
import { DEFAULT_BILL_PREFS, type BillPrefs, type Invoice } from '@/lib/bills/types';
import { hashStr, mulberry32, monthLabelOf, uid, weekdayShortDate } from '@/lib/format';
import { persisted } from './persist';

export type { BillPrefs, Invoice } from '@/lib/bills/types';
/** Dati per annullare un pagamento registrato (vedi markInvoicePaid / undoInvoicePaid). */
export type PaidToken = { prev: Invoice; nextId?: string };
export type PayOpts = { date: string; amount: number; record: boolean; installment?: number };

/** src: 'bank' = viene da un estratto conto (fa fede); 'manual' = inserito a mano o da uno scontrino, in attesa che arrivi l'estratto */
export type Movement = { date: string; label: string; amount: number; src?: 'bank' | 'manual' };
export type FinSnapshot = Pick<FinState, 'insights' | 'savingsPct' | 'months' | 'budget' | 'bills' | 'invoices' | 'billPrefs' | 'tax' | 'statementAt' | 'statementInfo'>;
export type StatementInfo = Analysis & { count: number; balanceKnown: boolean; balance?: number; at: number };
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
  { n: 'Affitto', p: 40, c: '#5b8def' }, { n: 'Fondo emergenza', p: 5, c: '#7c5cff' }, { n: 'Alimentari/Casa', p: 17, c: '#4fd18b' },
  { n: 'Cassa malati', p: 14, c: '#ff6f91' }, { n: 'Abbigliamento', p: 3, c: '#b96bff' }, { n: 'Viaggio estero', p: 4, c: '#4fc7e0' },
  { n: 'Abbonamenti', p: 4, c: '#c9d15c' }, { n: 'Altro', p: 13, c: '#ffb84f' },
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
  { name: 'Affitto', amount: 1450, freq: 'monthly' }, { name: 'Cassa malati', amount: 480, freq: 'monthly' },
  { name: 'Elettricità', amount: 62, freq: 'monthly' }, { name: 'Internet e telefono', amount: 79, freq: 'monthly' },
  { name: 'Assicurazione RC e economia domestica', amount: 190, freq: 'yearly' }, { name: 'Serafe (canone radio-TV)', amount: 335, freq: 'yearly' },
  { name: 'Abbonamento trasporti', amount: 85, freq: 'monthly' }, { name: 'Palestra', amount: 69, freq: 'monthly' },
  { name: 'Netflix', amount: 15.9, freq: 'monthly' }, { name: 'Spotify', amount: 12.95, freq: 'monthly' },
  { name: 'Imposte accantonate', amount: 150, freq: 'monthly' }, { name: 'Benzina o trasporti', amount: 60, freq: 'monthly' },
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

/** Sottoinsieme dello stato finanza usato dalle funzioni pure/di sola lettura. */
export type FinState0 = Pick<FinState, 'months' | 'categories' | 'budget' | 'guidelines'>;

type FinState = {
  categories: FinCategory[];
  insights: Insight[];
  savingsPct: number;
  /** obiettivo di risparmio con scadenza (vacanza): quanto serve, per quale mese (AAAA-MM) e quanto hai già messo da parte */
  vacation: { name: string; goal: number; target: string; saved: number } | null;
  setVacation: (v: { name: string; goal: number; target: string; saved: number } | null) => void;
  months: FinMonth[];
  budget: Budget;
  guidelines: Record<string, number>;
  bills: Bill[];
  /** Bollette e fatture da pagare (con scadenza, piano e promemoria). Separate dai costi ricorrenti `bills`. */
  invoices: Invoice[];
  billPrefs: BillPrefs;
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
  /** Ripristini per "annulla" dopo un'eliminazione. */
  restoreMovement: (idx: number, mi: number, mv: Movement) => void;
  restoreBill: (b: Bill, at: number) => void;
  restoreStock: (st: Stock, at: number) => void;
  restoreOrder: (o: PendingOrder) => void;
  addInvoice: (v: Omit<Invoice, 'id' | 'state' | 'remind' | 'createdAt' | 'history'> & Partial<Pick<Invoice, 'remind' | 'state'>>, log?: string) => string;
  patchInvoice: (id: string, patch: Partial<Invoice>, log?: string) => void;
  delInvoice: (id: string) => { inv: Invoice; at: number } | null;
  restoreInvoice: (inv: Invoice, at: number) => void;
  /** Segna come pagata (o una rata). Opzionale: registra il movimento e crea la prossima scadenza se e' ricorrente. */
  markInvoicePaid: (id: string, o: PayOpts) => PaidToken | null;
  undoInvoicePaid: (tok: PaidToken) => void;
  setBillPrefs: (p: Partial<BillPrefs>) => void;
  /** Aggiunge più bollette in un colpo, saltando i nomi già presenti. Restituisce quante ne ha aggiunte. */
  addBills: (list: Omit<Bill, 'id'>[]) => number;
  setTax: (p: Partial<TaxDecl>) => void;
  setTaxDoc: (k: string, f: TaxDocFile | null) => void;
  rollMonth: () => void;
  /** Aggiunge movimenti importati (data ISO). Crea i mesi mancanti (chiusi) e tiene coerenti i saldi. */
  importMovements: (rows: { date: string; label: string; amount: number }[], src?: 'bank' | 'manual') => { added: number; newMonths: number; future: number };
  /** L'estratto conto ha la precedenza: i movimenti attuali vengono sostituiti da quelli dell'estratto (i mesi senza estratto restano vuoti). */
  replaceWithStatement: (rows: { date: string; label: string; amount: number }[], opts?: { balance?: number | null }) => { added: number; removed: number; months: number; future: number; previous: FinMonth[] };
  /** Estratto successivo: aggiunge solo le righe mancanti e toglie gli inserimenti a mano che l'estratto ora conferma. */
  mergeStatement: (rows: { date: string; label: string; amount: number }[], opts?: { balance?: number | null }) => { added: number; known: number; confirmedManual: number; previous: FinMonth[] };
  hasBankData: () => boolean;
  /** Cancella i dati personali di finanza (movimenti, budget, spese fisse, bollette, fisco, estratto). Restano LifePoints e investimenti. Restituisce com'era prima per l'annulla. */
  clearPersonalFinance: () => FinSnapshot;
  restoreFinance: (s: FinSnapshot) => void;
  /** Cosa risulta dall'estratto (periodo, stipendio, spese fisse) e se il saldo e' quello vero della banca: serve a spiegare ogni numero. */
  statementInfo: StatementInfo | null;
  setStatementInfo: (i: StatementInfo | null) => void;
  /** Imposta il saldo vero del conto: il saldo mostrato parte da questo. */
  setBalance: (value: number) => void;
  /** Regola dello stipendio (es. dal 20 al 10) e fonti escluse: dopo ogni cambio si rifa' l'analisi dell'estratto. */
  salaryRule: SalaryRule;
  salaryExcluded: string[];
  avgRule: AvgRule;
  /** importi delle spese fisse impostati a mano (chiave = voce), che valgono al posto di quelli calcolati dall'estratto */
  fixedOverrides: Record<string, number>;
  setFixedOverride: (key: string, amount: number | null) => void;
  setSalaryRule: (r: SalaryRule, excluded?: string[], avg?: AvgRule) => void;
  recomputeStatement: (opts?: { apply?: boolean; balance?: number | null }) => void;
  replaceBills: (list: Omit<Bill, 'id'>[]) => void;
  restoreMonths: (months: FinMonth[]) => void;
  /** quando hai caricato l'ultimo estratto conto (serve al promemoria mensile) */
  statementAt: number | null;
  setStatementAt: (ts: number | null) => void;

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
  vacation: null as FinState['vacation'],
  months: [{ label: startMonthLabel(), start: 0, locked: false, movements: [] }] as FinMonth[],
  budget: { salary: 0, saveToEmergency: true, alloc: {} } as Budget,
  guidelines: defaultGuidelines,
  bills: [] as Bill[],
  invoices: [] as Invoice[],
  billPrefs: { ...DEFAULT_BILL_PREFS },
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
    resetBudget: () => set((s) => ({ budget: defaultBudget(s.budget.salary || 3500, s.budget.saveToEmergency, s.categories, s.months) })),
    setVacation: (v) => set({ vacation: v }),
    setGuidelineSalary: (v) => set((s) => ({ budget: { ...s.budget, salary: v } })),
    addBill: (b) => set((s) => ({ bills: [...s.bills, { id: uid(), ...b }] })),
    addBills: (list) => {
      const have = new Set(get().bills.map((b) => normBill(b.name)));
      const add = list.filter((b) => { const k = normBill(b.name); if (!k || have.has(k)) return false; have.add(k); return true; });
      if (add.length) set((s) => ({ bills: [...s.bills, ...add.map((b) => ({ id: uid(), ...b }))] }));
      return add.length;
    },
    delBill: (id) => set((s) => ({ bills: s.bills.filter((b) => b.id !== id) })),
    restoreMovement: (idx, mi, mv) => set((s) => ({ months: s.months.map((m, i) => { if (i !== idx) return m; const a = m.movements.slice(); a.splice(Math.min(mi, a.length), 0, mv); return { ...m, movements: a }; }) })),
    restoreBill: (b, at) => set((s) => (s.bills.some((x) => x.id === b.id) ? s : { bills: (() => { const a = s.bills.slice(); a.splice(Math.min(at, a.length), 0, b); return a; })() })),
    restoreStock: (st, at) => set((s) => (s.stocks.some((x) => x.symbol === st.symbol) ? s : { stocks: (() => { const a = s.stocks.slice(); a.splice(Math.min(at, a.length), 0, st); return a; })() })),
    restoreOrder: (o) => set((s) => (s.orders.some((x) => x.id === o.id) ? s : { orders: [...s.orders, o] })),
    addInvoice: (v, log) => {
      const id = uid();
      const now = new Date().toISOString();
      const inv: Invoice = { remind: true, state: 'open', ...v, id, createdAt: now, history: [{ at: now, text: log ?? 'Aggiunta' }] };
      set((st) => ({ invoices: [...st.invoices, inv] }));
      return id;
    },
    patchInvoice: (id, patch, log) => set((st) => ({
      invoices: st.invoices.map((i) => (i.id !== id ? i : { ...i, ...patch, history: log ? [...i.history, { at: new Date().toISOString(), text: log }] : i.history })),
    })),
    delInvoice: (id) => {
      const list = get().invoices;
      const at = list.findIndex((i) => i.id === id);
      if (at < 0) return null;
      set({ invoices: list.filter((i) => i.id !== id) });
      return { inv: list[at], at };
    },
    restoreInvoice: (inv, at) => set((st) => (st.invoices.some((x) => x.id === inv.id) ? st : { invoices: (() => { const a = st.invoices.slice(); a.splice(Math.min(at, a.length), 0, inv); return a; })() })),
    markInvoicePaid: (id, o) => {
      const prev = get().invoices.find((i) => i.id === id);
      if (!prev) return null;
      const now = new Date().toISOString();
      let inv: Invoice = { ...prev, history: [...prev.history] };
      let fullyPaid = true;
      if (o.installment != null && prev.installments?.[o.installment]) {
        const ins = prev.installments.map((x, k) => (k === o.installment ? { ...x, paidAt: o.date } : x));
        fullyPaid = ins.every((x) => x.paidAt);
        inv.installments = ins;
        inv.history.push({ at: now, text: `Rata ${o.installment + 1} di ${ins.length} pagata (${o.amount.toFixed(2)} ${prev.currency})` });
        if (fullyPaid) { inv.state = 'paid'; inv.paidAt = o.date; inv.paidAmount = prev.amount; }
      } else {
        inv.state = 'paid'; inv.paidAt = o.date; inv.paidAmount = o.amount;
        inv.history.push({ at: now, text: `Pagata (${o.amount.toFixed(2)} ${prev.currency})` });
      }
      let months = get().months;
      if (o.record && months[0] && !months[0].locked) {
        const dd = `${o.date.slice(8, 10)}/${o.date.slice(5, 7)}`;
        const mv: Movement = { date: dd, label: `Bolletta · ${prev.issuer}`, amount: -Math.abs(o.amount) };
        months = months.map((m, i) => (i === 0 ? { ...m, movements: [...m.movements, mv] } : m));
        inv.movement = { month: months[0].label, date: mv.date, label: mv.label, amount: mv.amount };
        inv.history.push({ at: now, text: 'Registrata come movimento' });
      }
      let nextId: string | undefined;
      const list = get().invoices.map((i) => (i.id === id ? inv : i));
      if (fullyPaid && prev.recurrence && !prev.installments?.length) {
        const nx = nextOccurrence(prev);
        const dup = nx && list.some((i) => i.state === 'open' && i.issuer === prev.issuer && i.dueDate && nx.dueDate && Math.abs(new Date(i.dueDate).getTime() - new Date(nx.dueDate).getTime()) < 12 * 86400000);
        if (nx && !dup) {
          nextId = uid();
          list.push({ ...nx, id: nextId, createdAt: now, history: [{ at: now, text: 'Scadenza stimata dalla ricorrenza: aggiorna importo e data quando arriva il documento' }] });
        }
      }
      set({ invoices: list, months });
      return { prev, nextId };
    },
    undoInvoicePaid: (tok) => set((st) => {
      let months = st.months;
      const cur = st.invoices.find((i) => i.id === tok.prev.id);
      const mvInfo = cur?.movement;
      if (mvInfo) {
        const mi = months.findIndex((m) => m.label === mvInfo.month);
        if (mi >= 0) {
          const k = months[mi].movements.findIndex((x) => x.date === mvInfo.date && x.label === mvInfo.label && x.amount === mvInfo.amount);
          if (k >= 0) months = months.map((m, i) => (i === mi ? { ...m, movements: m.movements.filter((_, j) => j !== k) } : m));
        }
      }
      return { months, invoices: st.invoices.filter((i) => i.id !== tok.nextId).map((i) => (i.id === tok.prev.id ? tok.prev : i)) };
    }),
    setBillPrefs: (p) => set((st) => ({ billPrefs: { ...st.billPrefs, ...p } })),
    setTax: (p) => set((s) => ({ tax: { ...s.tax, ...p } })),
    setTaxDoc: (k, f) => set((s) => {
      const docs = { ...s.tax.docs };
      if (f) docs[k] = f; else delete docs[k];
      return { tax: { ...s.tax, docs } };
    }),


    restoreMonths: (months) => set({ months }),
    hasBankData: () => get().months.some((m) => m.movements.some((x) => x.src === 'bank')),
    clearPersonalFinance: () => {
      const s = get();
      const snap: FinSnapshot = { insights: s.insights, savingsPct: s.savingsPct, months: s.months, budget: s.budget, bills: s.bills, invoices: s.invoices, billPrefs: s.billPrefs, tax: s.tax, statementAt: s.statementAt, statementInfo: s.statementInfo };
      const b = blank();
      set({ insights: b.insights, savingsPct: b.savingsPct, months: b.months, budget: b.budget, bills: b.bills, invoices: b.invoices, billPrefs: b.billPrefs, tax: b.tax, statementAt: null, statementInfo: null, fixedOverrides: {} });
      return snap;
    },
    restoreFinance: (snap) => set({ ...snap }),
    replaceBills: (list) => set({ bills: list.map((b) => ({ id: uid(), ...b })) }),
    mergeStatement: (rows, opts) => {
      const previous = get().months;
      const names = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      const labelOfIso = (iso: string) => `${names[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
      const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
      const have = new Map<string, number>();
      previous.forEach((m) => m.movements.forEach((x) => { if (x.src === 'manual') return; const k = `${m.label}|${x.date}|${Math.round(x.amount * 100)}`; have.set(k, (have.get(k) ?? 0) + 1); }));
      const fresh: typeof rows = []; let known = 0;
      for (const r of rows) { const k = `${labelOfIso(r.date)}|${ddmm(r.date)}|${Math.round(r.amount * 100)}`; const n = have.get(k) ?? 0; if (n > 0) { have.set(k, n - 1); known++; } else fresh.push(r); }
      // gli inserimenti a mano (o da scontrino) che l'estratto ora conferma (stesso importo, date vicine) si tolgono: vale l'estratto
      const day = (label: string, d: string) => { const [n, y] = label.split(' '); return new Date(Number(y), names.indexOf(n), Number(d.slice(0, 2))).getTime(); };
      const pool = rows.map((r) => ({ t: new Date(r.date + 'T00:00:00').getTime(), cents: Math.round(r.amount * 100), used: false }));
      let confirmedManual = 0;
      const cleaned = previous.map((m) => ({ ...m, movements: m.movements.filter((x) => {
        if (x.src !== 'manual') return true;
        const tt = day(m.label, x.date); const cents = Math.round(x.amount * 100);
        const hit = pool.find((p) => !p.used && p.cents === cents && Math.abs(p.t - tt) <= 4 * 86400000);
        if (hit) { hit.used = true; confirmedManual++; return false; }
        return true;
      }) }));
      set({ months: cleaned, insights: [], savingsPct: 0 });
      const res = fresh.length ? get().importMovements(fresh, 'bank') : { added: 0 };
      if (typeof opts?.balance === 'number') { const ms = get().months.map((m) => ({ ...m })); const end = ms[0].start + ms[0].movements.reduce((s, x) => s + x.amount, 0); const d = opts.balance - end; ms.forEach((m) => { m.start = Math.round((m.start + d) * 100) / 100; }); set({ months: ms }); }
      return { added: res.added, known, confirmedManual, previous };
    },
    statementAt: null,
    salaryRule: DEFAULT_RULE,
    salaryExcluded: [] as string[],
    avgRule: DEFAULT_AVG,
    fixedOverrides: {} as Record<string, number>,
    setFixedOverride: (key, amount) => { set((s) => { const o = { ...(s.fixedOverrides ?? {}) }; if (amount == null) delete o[key]; else o[key] = amount; return { fixedOverrides: o }; }); get().recomputeStatement(); },
    setSalaryRule: (r, excluded, avg) => { set((s) => ({ salaryRule: r, salaryExcluded: excluded ?? s.salaryExcluded, avgRule: avg ?? s.avgRule })); get().recomputeStatement(); },
    recomputeStatement: (opts) => {
      const s = get();
      const rows = listMovements(s.months, () => true).map((r) => ({ date: r.sort, label: r.label, amount: r.amount }));
      const an0 = analyzeStatement(rows, s.salaryRule, s.salaryExcluded, s.avgRule);
      if (!an0) return;
      const ov = s.fixedOverrides ?? {};
      const an = { ...an0, fixed: an0.fixed.map((f) => (ov[f.key] != null ? { ...f, monthly: ov[f.key], overridden: { by: 'utente' as const, calculated: f.monthly } } : f)) };
      const old = s.statementInfo;
      const bal = typeof opts?.balance === 'number' ? opts.balance : old?.balance;
      const info: StatementInfo = { ...an, count: rows.length, balanceKnown: typeof opts?.balance === 'number' || !!old?.balanceKnown, ...(bal !== undefined ? { balance: bal } : {}), at: Date.now() };
      if (opts?.apply === false) { set({ statementInfo: info }); return; }
      set({ statementInfo: info, budget: { ...s.budget, salary: an.salary.monthly || s.budget.salary }, bills: an.fixed.map((f) => ({ id: uid(), name: f.name, amount: f.monthly, freq: 'monthly' as const })) });
    },
    statementInfo: null,
    setStatementInfo: (i) => set({ statementInfo: i }),
    setBalance: (value) => set((s) => { const ms = s.months.map((m) => ({ ...m })); if (!ms.length) return s; const end = ms[0].start + ms[0].movements.reduce((a, x) => a + x.amount, 0); const d = value - end; ms.forEach((m) => { m.start = Math.round((m.start + d) * 100) / 100; }); return { months: ms, statementInfo: s.statementInfo ? { ...s.statementInfo, balanceKnown: true, balance: value } : s.statementInfo }; }),
    setStatementAt: (ts) => set({ statementAt: ts }),
    replaceWithStatement: (rows, opts) => {
      const names = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      const keyOfLabel = (l: string) => { const [n, y] = l.split(' '); const i = names.indexOf(n); return i < 0 || !y ? -1 : Number(y) * 12 + i; };
      const labelOfIso = (iso: string) => `${names[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
      const previous = get().months;
      const removed = previous.reduce((s, m) => s + m.movements.length, 0);
      const curKey = previous.length ? keyOfLabel(previous[0].label) : -1;
      const groups = new Map<string, { date: string; label: string; amount: number }[]>();
      let future = 0;
      rows.forEach((r) => {
        const lab = labelOfIso(r.date);
        if (curKey >= 0 && keyOfLabel(lab) > curKey) { future++; return; }
        groups.set(lab, [...(groups.get(lab) ?? []), r]);
      });
      if (!groups.size) return { added: 0, removed: 0, months: 0, future, previous };
      const order = [...groups.entries()].sort((a, b) => keyOfLabel(b[0]) - keyOfLabel(a[0]));
      const months: FinMonth[] = [];
      let added = 0;
      order.forEach(([lab, list], i) => {
        const mvs: Movement[] = list.slice().sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ date: `${r.date.slice(8, 10)}/${r.date.slice(5, 7)}`, label: r.label, amount: r.amount, src: 'bank' as const }));
        months.push({ label: lab, start: 0, locked: i > 0, movements: mvs });
        added += mvs.length;
      });
      /* il saldo non si inventa: il mese piu' vecchio parte da 0 e ogni mese riparte dalla fine del precedente (il saldo vero si imposta a parte) */
      let acc = 0;
      for (let i = months.length - 1; i >= 0; i--) { months[i].start = Math.round(acc * 100) / 100; acc += months[i].movements.reduce((s, x) => s + x.amount, 0); }
      if (typeof opts?.balance === 'number') { const end = months[0].start + months[0].movements.reduce((s, x) => s + x.amount, 0); const d = opts.balance - end; months.forEach((m) => { m.start = Math.round((m.start + d) * 100) / 100; }); }
      set({ months, insights: [], savingsPct: 0 });
      return { added, removed, months: months.length, future, previous };
    },
    importMovements: (rows, src) => {
      const names = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      const keyOfLabel = (l: string) => { const [n, y] = l.split(' '); const i = names.indexOf(n); return i < 0 || !y ? -1 : Number(y) * 12 + i; };
      const labelOfIso = (iso: string) => `${names[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
      const months = get().months.map((m) => ({ ...m, movements: m.movements.slice() }));
      const curKey = months.length ? keyOfLabel(months[0].label) : -1;
      const groups = new Map<string, { date: string; label: string; amount: number }[]>();
      let future = 0;
      rows.forEach((r) => {
        const lab = labelOfIso(r.date);
        if (curKey >= 0 && keyOfLabel(lab) > curKey) { future++; return; }
        groups.set(lab, [...(groups.get(lab) ?? []), r]);
      });
      let added = 0, newMonths = 0;
      [...groups.entries()].sort((a, b) => keyOfLabel(b[0]) - keyOfLabel(a[0])).forEach(([lab, list]) => {
        const mvs: Movement[] = list.slice().sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ date: `${r.date.slice(8, 10)}/${r.date.slice(5, 7)}`, label: r.label, amount: r.amount, ...(src ? { src } : {}) }));
        const net = mvs.reduce((sum, x) => sum + x.amount, 0);
        const idx = months.findIndex((m) => m.label === lab);
        if (idx >= 0) {
          months[idx] = { ...months[idx], movements: [...months[idx].movements, ...mvs], start: idx > 0 ? months[idx].start - net : months[idx].start };
        } else {
          // nuovo mese storico: lo inserisco al posto giusto (dal più recente) e ricavo il saldo iniziale dal mese successivo
          let at = months.findIndex((m) => keyOfLabel(m.label) < keyOfLabel(lab));
          if (at < 0) at = months.length;
          const newer = at > 0 ? months[at - 1] : null;
          months.splice(at, 0, { label: lab, start: (newer ? newer.start : 0) - net, locked: true, movements: mvs });
          newMonths++;
        }
        added += mvs.length;
      });
      if (added) set({ months });
      return { added, newMonths, future };
    },

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

// Promemoria locali delle bollette: si riprogrammano da soli quando cambiano bollette o preferenze (solo nel telefono, in modo differito).
if (Platform.OS !== 'web') {
  setTimeout(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('@/lib/bills/schedule') as typeof import('@/lib/bills/schedule')).startBillReminderSync();
    } catch { /* promemoria non disponibili */ }
  }, 2500);
}

export const holdings = (stocks: Stock[]) => stocks.filter((s) => s.shares > 0);
