/**
 * Piano di pagamento delle bollette. Puro: riceve bollette, saldo, entrate attese e preferenze, restituisce un piano
 * ordinato per scadenza con la data entro cui pagare, la liquidita' prevista e suggerimenti. NON decide e non paga nulla.
 */
import { addBusinessDays, addMonths, diffDays, isIso, type Calendar } from './dates.ts';
import type { BillPrefs, BillStatus, Installment, Invoice, Recurrence } from './types.ts';

export const SOON_DAYS_DEFAULT = 7;

/** Rate/scadenze ancora da pagare di una bolletta aperta. Senza scadenza (dueDate mancante) la lista e' vuota. */
export type DueItem = { key: string; invoiceId: string; dueDate: string; amount: number; n?: number; of?: number };
export function dueItemsOf(inv: Invoice): DueItem[] {
  if (inv.state !== 'open') return [];
  if (inv.installments?.length) {
    const sorted = inv.installments.map((x, i) => ({ ...x, i })).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return sorted.filter((x) => !x.paidAt).map((x) => ({ key: `${inv.id}#${x.i + 1}`, invoiceId: inv.id, dueDate: x.dueDate, amount: x.amount, n: x.i + 1, of: sorted.length }));
  }
  return inv.dueDate && isIso(inv.dueDate) ? [{ key: inv.id, invoiceId: inv.id, dueDate: inv.dueDate, amount: inv.amount }] : [];
}

/** Importo ancora da pagare (somma delle rate non pagate, o l'importo intero). */
export function outstanding(inv: Invoice): number {
  if (inv.state !== 'open') return 0;
  if (inv.installments?.length) return round2(inv.installments.filter((x) => !x.paidAt).reduce((s, x) => s + x.amount, 0));
  return inv.amount;
}
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Prossima scadenza ancora da pagare (data ISO) o undefined. */
export function nextDueDate(inv: Invoice): string | undefined {
  const d = dueItemsOf(inv).map((x) => x.dueDate).sort();
  return d[0];
}

export function statusOf(inv: Invoice, today: string, soonDays = SOON_DAYS_DEFAULT): BillStatus {
  if (inv.state === 'paid') return 'pagata';
  if (inv.state === 'disputed') return 'contestata';
  if (inv.installments?.length) {
    const next = nextDueDate(inv);
    if (!next) return 'pagata';
    return diffDays(today, next) < 0 ? 'scaduta' : 'rateizzata';
  }
  if (!inv.dueDate || !isIso(inv.dueDate)) return 'da_pagare';
  const d = diffDays(today, inv.dueDate);
  return d < 0 ? 'scaduta' : d <= soonDays ? 'in_scadenza' : 'da_pagare';
}

/** Rateizza un importo in n rate mensili (i centesimi di resto vanno sulla prima). */
export function splitInstallments(total: number, n: number, firstDue: string, everyMonths = 1): Installment[] {
  const parts = Math.max(1, Math.min(60, Math.round(n)));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const rest = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => ({ dueDate: addMonths(firstDue, i * everyMonths), amount: (base + (i === 0 ? rest : 0)) / 100 }));
}

const REC_MONTHS: Record<Recurrence, number> = { monthly: 1, bimonthly: 2, quarterly: 3, yearly: 12 };
export const recurrenceMonths = (r: Recurrence) => REC_MONTHS[r];
/** Scadenza stimata successiva (stesso giorno del mese, accorciato se serve). */
export function nextDue(due: string, r: Recurrence, times = 1): string { return addMonths(due, REC_MONTHS[r] * times); }

/** Bolletta ricorrente stimata dopo il pagamento di quella precedente (da confermare quando arriva il documento vero). */
export function nextOccurrence(inv: Invoice): Omit<Invoice, 'id' | 'createdAt' | 'history'> | null {
  if (!inv.recurrence || !inv.dueDate) return null;
  const m = REC_MONTHS[inv.recurrence];
  return {
    issuer: inv.issuer, kind: inv.kind, amount: inv.amount, currency: inv.currency,
    dueDate: addMonths(inv.dueDate, m),
    ...(inv.periodFrom ? { periodFrom: addMonths(inv.periodFrom, m) } : {}), ...(inv.periodTo ? { periodTo: addMonths(inv.periodTo, m) } : {}),
    ...(inv.iban ? { iban: inv.iban } : {}), recurrence: inv.recurrence, estimated: true,
    ...(inv.lateFee != null ? { lateFee: inv.lateFee } : {}), ...(inv.lateInterestPct != null ? { lateInterestPct: inv.lateInterestPct } : {}),
    state: 'open', remind: inv.remind,
  };
}

/** Costo stimato del ritardo: penale fissa + interesse di mora annuo sui giorni di ritardo. undefined se non e' noto nulla. */
export function lateCost(inv: Pick<Invoice, 'lateFee' | 'lateInterestPct'>, amount: number, daysLate: number): number | undefined {
  if (inv.lateFee == null && inv.lateInterestPct == null) return undefined;
  const interest = inv.lateInterestPct ? (amount * inv.lateInterestPct / 100) * (Math.max(0, daysLate) / 365) : 0;
  return round2((inv.lateFee ?? 0) + interest);
}

// ---------------------------------------------------------------- piano

export type Advice =
  | { code: 'overdue_now' }
  | { code: 'tight' }
  | { code: 'wait_income'; date: string }
  | { code: 'penalty_first' }
  | { code: 'can_postpone' }
  | { code: 'split' };

export type PlanItem = {
  key: string; invoiceId: string; issuer: string; kind: Invoice['kind']; currency: string;
  amount: number; dueDate: string; payBy: string; daysToDue: number;
  status: 'scaduta' | 'in_scadenza' | 'da_pagare';
  installment?: { n: number; of: number };
  /** Costo stimato del ritardo gia' maturato (se scaduta) o potenziale (penale dichiarata). */
  lateCost?: number; lateCostIsPotential?: boolean;
  hasPenalty: boolean;
  /** payBy ridotto a oggi perche' il margine per il bonifico e' gia' consumato. */
  tight: boolean;
  balanceAfter?: number; shortfall?: number;
  /** Importo in valuta diversa da quella del saldo: non entra nel calcolo della liquidita'. */
  foreign?: boolean;
  advice: Advice[];
};
export type PlanWarning = { date: string; missing: number; keys: string[]; postpone: string[]; split?: string };
export type PlanInput = {
  invoices: Invoice[];
  today: string;
  balance: number;
  currency: string;
  incomes?: { date: string; amount: number }[];
  fixedOutflows?: { date: string; amount: number; label?: string }[];
  prefs: Pick<BillPrefs, 'safetyDays' | 'soonDays' | 'reserve' | 'countries'>;
  extraHolidays?: string[];
  /** Orizzonte massimo della simulazione (giorni). */
  horizonDays?: number;
};
export type PlanResult = {
  items: PlanItem[];
  warnings: PlanWarning[];
  /** Scadenze senza data (non entrano nel piano). */
  undated: string[];
  totalOverdue: number;
  totalNext30: number;
  minBalance?: { date: string; value: number };
};

export function buildPlan(inp: PlanInput): PlanResult {
  const { today, prefs } = inp;
  const cal: Calendar = { countries: prefs.countries, extra: inp.extraHolidays };
  const horizon = inp.horizonDays ?? 120;
  const raw: PlanItem[] = [];
  const undated: string[] = [];
  for (const inv of inp.invoices) {
    if (inv.state !== 'open') continue;
    const dues = dueItemsOf(inv);
    if (!dues.length) { undated.push(inv.id); continue; }
    for (const d of dues) {
      const daysToDue = diffDays(today, d.dueDate);
      if (daysToDue > horizon) continue;
      const target = addBusinessDays(d.dueDate, -Math.max(0, prefs.safetyDays), cal);
      const overdue = daysToDue < 0;
      const payBy = overdue || diffDays(today, target) < 0 ? today : target;
      const tight = !overdue && diffDays(today, target) < 0;
      const status: PlanItem['status'] = overdue ? 'scaduta' : daysToDue <= prefs.soonDays ? 'in_scadenza' : 'da_pagare';
      const hasPenalty = inv.lateFee != null || inv.lateInterestPct != null || (inv.reminderLevel ?? 0) > 0;
      const lc = lateCost(inv, d.amount, overdue ? -daysToDue : 0);
      raw.push({
        key: d.key, invoiceId: inv.id, issuer: inv.issuer, kind: inv.kind, currency: inv.currency, amount: d.amount, dueDate: d.dueDate, payBy, daysToDue, status,
        ...(d.n ? { installment: { n: d.n, of: d.of as number } } : {}), ...(lc != null ? { lateCost: lc, lateCostIsPotential: !overdue } : {}),
        hasPenalty, tight, foreign: inv.currency !== inp.currency, advice: [],
      });
    }
  }
  // ordine: per scadenza, poi chi ha penali, poi importo
  raw.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || Number(b.hasPenalty) - Number(a.hasPenalty) || b.amount - a.amount);
  // ordine di pagamento nella simulazione: per data in cui si paga
  const payOrder = raw.slice().sort((a, b) => a.payBy.localeCompare(b.payBy) || a.dueDate.localeCompare(b.dueDate) || Number(b.hasPenalty) - Number(a.hasPenalty));
  const incomes = (inp.incomes ?? []).filter((x) => isIso(x.date) && x.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
  const fixed = (inp.fixedOutflows ?? []).filter((x) => isIso(x.date) && x.amount > 0);
  const reserve = Math.max(0, prefs.reserve || 0);
  let paid = 0;
  const balanceAt = (date: string) =>
    inp.balance + incomes.filter((x) => x.date >= today && x.date <= date).reduce((s, x) => s + x.amount, 0)
    - fixed.filter((x) => x.date >= today && x.date <= date).reduce((s, x) => s + x.amount, 0) - paid;
  const warnings: PlanWarning[] = [];
  let minBalance: PlanResult['minBalance'];
  for (const it of payOrder) {
    if (it.foreign) continue;
    const before = balanceAt(it.payBy);
    const after = round2(before - it.amount);
    paid += it.amount;
    it.balanceAfter = after;
    if (!minBalance || after < minBalance.value) minBalance = { date: it.payBy, value: after };
    if (after < reserve) {
      it.shortfall = round2(reserve - after);
      const w = warnings.find((x) => x.date === it.payBy);
      if (w) { w.missing = Math.max(w.missing, it.shortfall); w.keys.push(it.key); } else warnings.push({ date: it.payBy, missing: it.shortfall, keys: [it.key], postpone: [] });
    }
  }
  // consigli
  for (const it of raw) {
    if (it.status === 'scaduta') it.advice.push({ code: 'overdue_now' });
    else if (it.tight) it.advice.push({ code: 'tight' });
    if (it.shortfall) {
      const inc = incomes.find((x) => x.date > it.payBy && x.date <= it.dueDate);
      if (inc) it.advice.push({ code: 'wait_income', date: inc.date });
      if (it.hasPenalty) it.advice.push({ code: 'penalty_first' });
      else it.advice.push({ code: 'can_postpone' });
      if (it.amount >= 150) it.advice.push({ code: 'split' });
    }
  }
  for (const w of warnings) {
    const group = raw.filter((x) => w.keys.includes(x.key));
    // candidate da spostare: senza penali, con piu' margine fra data di pagamento e scadenza
    w.postpone = group.filter((x) => !x.hasPenalty).sort((a, b) => diffDays(b.payBy, b.dueDate) - diffDays(a.payBy, a.dueDate)).map((x) => x.key);
    const big = group.slice().sort((a, b) => b.amount - a.amount)[0];
    if (big && big.amount >= 150) w.split = big.key;
  }
  const t30 = raw.filter((x) => x.daysToDue >= 0 && x.daysToDue <= 30 && x.currency === inp.currency).reduce((s, x) => s + x.amount, 0);
  const over = raw.filter((x) => x.daysToDue < 0 && x.currency === inp.currency).reduce((s, x) => s + x.amount, 0);
  return { items: raw, warnings, undated, totalOverdue: round2(over), totalNext30: round2(t30), minBalance };
}

/** Totali e conteggi per la lista (indipendenti dalla liquidita'). */
export function summarize(invoices: Invoice[], today: string, soonDays = SOON_DAYS_DEFAULT) {
  const counts: Record<BillStatus, number> = { da_pagare: 0, in_scadenza: 0, scaduta: 0, pagata: 0, rateizzata: 0, contestata: 0 };
  invoices.forEach((i) => { counts[statusOf(i, today, soonDays)]++; });
  return counts;
}

/** Ordine per la lista: prima le aperte per scadenza, poi contestate, poi pagate (piu' recenti prima). */
export function sortInvoices(list: Invoice[]): Invoice[] {
  const rank = (i: Invoice) => (i.state === 'open' ? 0 : i.state === 'disputed' ? 1 : 2);
  return list.slice().sort((a, b) => rank(a) - rank(b)
    || (a.state === 'paid' && b.state === 'paid' ? (b.paidAt ?? '').localeCompare(a.paidAt ?? '') : (nextDueDate(a) ?? a.dueDate ?? '9999-12-31').localeCompare(nextDueDate(b) ?? b.dueDate ?? '9999-12-31')));
}

/** Scadenze dei prossimi giorni per la barra "prossime scadenze": scadute in testa, poi per data. */
export function upcoming(invoices: Invoice[], today: string, days = 30): { invoiceId: string; key: string; dueDate: string; amount: number; issuer: string; overdue: boolean; currency: string }[] {
  const out: ReturnType<typeof upcoming> = [];
  for (const inv of invoices) for (const d of dueItemsOf(inv)) {
    const dd = diffDays(today, d.dueDate);
    if (dd <= days) out.push({ invoiceId: inv.id, key: d.key, dueDate: d.dueDate, amount: d.amount, issuer: inv.issuer, overdue: dd < 0, currency: inv.currency });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Stima delle prossime entrate dai movimenti: ricorrenze mensili di importi positivi alti (stipendio) -> date future. */
export function estimateIncomes(movements: { date: string; amount: number; label?: string }[], today: string, horizonDays = 70): { date: string; amount: number; estimated: true }[] {
  const pos = movements.filter((m) => m.amount > 0 && isIso(m.date));
  if (!pos.length) return [];
  const byLabel = new Map<string, { date: string; amount: number }[]>();
  pos.forEach((m) => { const k = (m.label ?? '').toLowerCase().replace(/\d+/g, '').trim() || '_'; byLabel.set(k, [...(byLabel.get(k) ?? []), m]); });
  let best: { date: string; amount: number }[] = [];
  byLabel.forEach((list) => {
    const total = list.reduce((s, x) => s + x.amount, 0);
    const bestTotal = best.reduce((s, x) => s + x.amount, 0);
    if (list.length >= 2 && total > bestTotal) best = list;
  });
  if (best.length < 2) return [];
  best = best.slice().sort((a, b) => a.date.localeCompare(b.date));
  const last = best[best.length - 1];
  const gaps = best.slice(1).map((x, i) => diffDays(best[i].date, x.date));
  const avgGap = gaps.reduce((s, x) => s + x, 0) / gaps.length;
  if (avgGap < 25 || avgGap > 35) return [];
  const amt = round2(best.slice(-3).reduce((s, x) => s + x.amount, 0) / Math.min(3, best.length));
  const out: { date: string; amount: number; estimated: true }[] = [];
  let d = last.date;
  for (let i = 1; i <= 4; i++) {
    d = addMonths(last.date, i);
    if (diffDays(today, d) >= 0 && diffDays(today, d) <= horizonDays) out.push({ date: d, amount: amt, estimated: true });
  }
  return out;
}

