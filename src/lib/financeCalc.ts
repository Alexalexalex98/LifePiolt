/** Il calcolo del mese (modulo PURO): entrate, spese fisse e variabili, fondo emergenza, quanto resta e il saldo sul conto. */
export type CalcMove = { label: string; amount: number };
export type CalcMonth = { label: string; start: number; movements: CalcMove[] };
export type CalcLine = { label: string; amount: number };
export type MonthCalc = {
  label: string; start: number; end: number;
  income: number;
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
export function monthCalc(m: CalcMonth, categoryOf: (label: string) => string, alloc: Record<string, number>): MonthCalc {
  const inc = m.movements.filter((x) => x.amount > 0);
  const out = m.movements.filter((x) => x.amount < 0).map((x) => ({ label: x.label, amount: -x.amount }));
  const income = r2(inc.reduce((a, x) => a + x.amount, 0));
  const group = (list: CalcLine[]): CalcLine[] => {
    const map = new Map<string, number>();
    list.forEach((x) => map.set(pretty(x.label), r2((map.get(pretty(x.label)) ?? 0) + x.amount)));
    return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  };
  const emergencyLines = out.filter((x) => EMERGENCY.test(x.label));
  const rest = out.filter((x) => !EMERGENCY.test(x.label));
  const fixed = group(rest.filter((x) => FIXED.test(x.label)));
  const variable = group(rest.filter((x) => !FIXED.test(x.label)));
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
  return { label: m.label, start: m.start, end: r2(m.start + net), income, fixed, fixedTotal, variable, variableTotal, emergency, expenses, left, savedPct: income > 0 ? Math.round(((emergency + left) / income) * 1000) / 10 : 0, byCategory };
}
