import type { Installment } from './types';

type Plan = { installments?: Installment[] };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Il totale del piano di rate, quanto è già pagato e quanto resta da pagare. */
export function planTotals(inv: Plan): { total: number; paid: number; left: number; count: number; paidCount: number } {
  const l = inv.installments ?? [];
  const total = r2(l.reduce((s, x) => s + x.amount, 0));
  const paid = r2(l.filter((x) => x.paidAt).reduce((s, x) => s + x.amount, 0));
  return { total, paid, left: r2(total - paid), count: l.length, paidCount: l.filter((x) => x.paidAt).length };
}

/** Quanto resta da pagare DOPO la rata `i` (si contano solo le rate non pagate che seguono, per data). */
export function leftAfter(inv: Plan, i: number): number {
  const l = inv.installments ?? [];
  const me = l[i]; if (!me) return 0;
  return r2(l.filter((x, k) => k !== i && !x.paidAt && (x.dueDate > me.dueDate || (x.dueDate === me.dueDate && k > i))).reduce((s, x) => s + x.amount, 0));
}

/** Rate con scadenza già passata e non segnate pagate: quando si carica un piano vecchio vanno confermate. */
export function pastUnpaid(inv: Plan, today: string): number[] {
  return (inv.installments ?? []).flatMap((x, i) => (!x.paidAt && x.dueDate < today ? [i] : []));
}
