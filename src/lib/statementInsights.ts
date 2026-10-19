/** Cosa si capisce da un estratto conto: periodo, totali, stipendio mensile e spese fisse. Modulo PURO e testabile. */
import { detectRecurring, normalizeLabel, type RecurringBill } from './recurring.ts';

export type Row = { date: string; label: string; amount: number };
export type IncomeSource = { name: string; monthly: number; months: number };
export type StatementInsights = { count: number; from: string; to: string; income: number; expense: number; salary: number; sources: IncomeSource[]; fixed: RecurringBill[] };

const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const NOT_SALARY = /deposito|bancomat|prelievo|giroconto|storno|rimborso|rettifica|einzahlung|bezug/i;
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Entrate che tornano ogni mese (almeno 3 mesi diversi): la loro somma mensile e' lo stipendio/reddito. */
export function detectIncome(rows: Row[]): IncomeSource[] {
  const groups = new Map<string, Row[]>();
  rows.filter((r) => r.amount > 0 && !NOT_SALARY.test(r.label)).forEach((r) => {
    const k = normalizeLabel(r.label.replace(/^(accredito|bonifico|gutschrift|zahlung)\s+/i, ''));
    if (k.length < 3) return;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  });
  const out: IncomeSource[] = [];
  groups.forEach((list, key) => {
    const perMonth = new Map<string, number>();
    list.forEach((r) => perMonth.set(r.date.slice(0, 7), (perMonth.get(r.date.slice(0, 7)) ?? 0) + r.amount));
    if (perMonth.size < 3) return;
    out.push({ name: titleCase(key).slice(0, 40), monthly: Math.round(median([...perMonth.values()]) * 100) / 100, months: perMonth.size });
  });
  return out.sort((a, b) => b.monthly * b.months - a.monthly * a.months).slice(0, 4);
}

export function insightsOf(rows: Row[]): StatementInsights | null {
  if (!rows.length) return null;
  const dates = rows.map((r) => r.date).sort();
  const sources = detectIncome(rows);
  return {
    count: rows.length, from: dates[0], to: dates[dates.length - 1],
    income: Math.round(rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0) * 100) / 100,
    expense: Math.round(-rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0) * 100) / 100,
    salary: Math.round(sources.reduce((s, x) => s + x.monthly, 0)),
    sources, fixed: detectRecurring(rows, []).filter((b) => b.freq === 'monthly'),
  };
}
