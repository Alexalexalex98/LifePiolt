/** Il calcolo del mese (modulo PURO): entrate, spese fisse e variabili, fondo emergenza, quanto resta e il saldo sul conto. */
export type CalcMove = { label: string; amount: number; date?: string };
export type CalcMonth = { label: string; start: number; movements: CalcMove[] };
export type CalcLine = { label: string; amount: number };
export type IncomeKind = 'salary' | 'other' | 'refund' | 'transfer';
export type IncomeLine = { label: string; amount: number; date: string; /** assente = l'app non è certa: va chiesto all'utente */ kind?: IncomeKind; key: string };
export type CalcOpts = {
  /** vero se il pagamento è una spesa fissa (dall'estratto); se manca si usano le parole chiave */
  isFixed?: (label: string) => boolean;
  /** tipo dell'entrata già noto (stipendio riconosciuto o scelto dall'utente); undefined = incerto */
  incomeKind?: (m: CalcMove & { date?: string }, key: string) => IncomeKind | undefined;
  /** movimenti che non contano (es. giroconti tra propri conti) */
  skip?: (key: string) => boolean;
};
export const moveKey = (month: string, m: { date?: string; label: string; amount: number }) => `${month}|${m.date ?? ''}|${m.label}|${m.amount}`;
export type MonthCalc = {
  label: string; start: number; end: number;
  income: number;
  incomeLines: IncomeLine[];
  incomeUnsure: number;
  /** giroconti tra i propri conti: non sono guadagno né spesa, ma cambiano quanto hai sul conto */
  transferIn: number; transferOut: number;
  /** saldo senza l'aiuto dei giroconti in entrata */
  endWithoutTransfers: number;
  fixed: CalcLine[]; fixedTotal: number;
  variable: CalcLine[]; variableTotal: number;
  emergency: number;
  expenses: number;
  /** entrate − spese − fondo emergenza: quello che resta */
  left: number;
  /** risparmiato = fondo emergenza + quello che resta, in % delle entrate */
  savedPct: number;
  byCategory: { name: string; spent: number; budget: number; left: number }[];
};

const FIXED = /affitto|pigione|cassa malati|elettricit|internet|telefono|abbonament|assicurazione|imposte|palestra|netflix|spotify|serafe/i;
const EMERGENCY = /fondo emergenza/i;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pretty = (l: string) => l.replace(/^[^·]+·\s*/, '').trim() || l;

/** `categoryOf` e `alloc` arrivano dal chiamante (categorie e budget dell'utente). */
export function monthCalc(m: CalcMonth, categoryOf: (label: string) => string, alloc: Record<string, number>, opts: CalcOpts = {}): MonthCalc {
  const keyOf = (x: CalcMove) => moveKey(m.label, x);
  const skipped = m.movements.filter((x) => opts.skip?.(keyOf(x)));
  const transferIn = r2(skipped.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0));
  const transferOut = r2(-skipped.filter((x) => x.amount < 0).reduce((a, x) => a + x.amount, 0));
  const live = m.movements.filter((x) => !opts.skip?.(keyOf(x)));
  const inc = live.filter((x) => x.amount > 0);
  const incomeLines: IncomeLine[] = inc.map((x) => ({ label: pretty(x.label), amount: x.amount, date: x.date ?? '', key: keyOf(x), kind: opts.incomeKind ? opts.incomeKind(x, keyOf(x)) : 'salary' })).sort((a, b) => b.amount - a.amount);
  const incomeUnsure = r2(incomeLines.filter((x) => !x.kind).reduce((a, x) => a + x.amount, 0));
  const out = live.filter((x) => x.amount < 0).map((x) => ({ label: x.label, amount: -x.amount }));
  const income = r2(inc.reduce((a, x) => a + x.amount, 0));
  const group = (list: CalcLine[]): CalcLine[] => {
    const map = new Map<string, number>();
    list.forEach((x) => map.set(pretty(x.label), r2((map.get(pretty(x.label)) ?? 0) + x.amount)));
    return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  };
  const emergencyLines = out.filter((x) => EMERGENCY.test(x.label));
  const rest = out.filter((x) => !EMERGENCY.test(x.label));
  const isFixed = opts.isFixed ?? ((l: string) => FIXED.test(l));
  const fixed = group(rest.filter((x) => isFixed(x.label)));
  const variable = group(rest.filter((x) => !isFixed(x.label)));
  const sum = (l: CalcLine[]) => r2(l.reduce((a, x) => a + x.amount, 0));
  const emergency = sum(emergencyLines);
  const fixedTotal = sum(fixed), variableTotal = sum(variable);
  const expenses = r2(fixedTotal + variableTotal);
  const left = r2(income - expenses - emergency);
  const spentBy: Record<string, number> = {};
  out.forEach((x) => { const c = categoryOf(x.label); spentBy[c] = r2((spentBy[c] ?? 0) + x.amount); });
  const names = [...new Set([...Object.keys(alloc), ...Object.keys(spentBy)])];
  const byCategory = names.map((name) => ({ name, spent: spentBy[name] ?? 0, budget: alloc[name] ?? 0, left: r2((alloc[name] ?? 0) - (spentBy[name] ?? 0)) })).sort((a, b) => b.spent - a.spent);
  const net = m.movements.reduce((a, x) => a + x.amount, 0);
  return { label: m.label, start: m.start, end: r2(m.start + net), income, incomeLines, incomeUnsure, transferIn, transferOut, endWithoutTransfers: r2(m.start + net - transferIn + transferOut), fixed, fixedTotal, variable, variableTotal, emergency, expenses, left, savedPct: income > 0 ? Math.round(((emergency + left) / income) * 1000) / 10 : 0, byCategory };
}
