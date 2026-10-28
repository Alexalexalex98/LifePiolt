import { t } from '../i18n/core.ts';

/** Resoconto delle spese: dove vanno i soldi, cosa compri e ogni quanto. Modulo PURO e testabile. */

export type SpendRow = { ts: number; label: string; amount: number; category: string; payee: string };
export type CategoryLine = { name: string; amount: number; pct: number; count: number };
export type PayeeLine = { name: string; count: number; total: number; avg: number; /** giorni medi tra un acquisto e l'altro (0 se uno solo) */ everyDays: number };
export type SpendReport = { total: number; count: number; categories: CategoryLine[]; payees: PayeeLine[] };

const DAY = 86400000;
const title = (s: string) => s.split(' ').map((w, i) => (i && ['e', 'di', 'da', 'del', 'la', 'il'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

export function spendReport(rows: SpendRow[], opts: { exclude?: string[]; maxPayees?: number } = {}): SpendReport {
  const out = rows.filter((r) => r.amount < 0 && !(opts.exclude ?? []).includes(r.category));
  const total = out.reduce((s, r) => s - r.amount, 0);
  const cat = new Map<string, { amount: number; count: number }>();
  const pay = new Map<string, { total: number; ts: number[] }>();
  for (const r of out) {
    const c = cat.get(r.category) ?? { amount: 0, count: 0 };
    c.amount -= r.amount; c.count++; cat.set(r.category, c);
    if (r.payee.length >= 3) { const p = pay.get(r.payee) ?? { total: 0, ts: [] }; p.total -= r.amount; p.ts.push(r.ts); pay.set(r.payee, p); }
  }
  const categories = [...cat].map(([name, v]) => ({ name, amount: Math.round(v.amount), count: v.count, pct: total ? Math.round((v.amount / total) * 1000) / 10 : 0 })).sort((a, b) => b.amount - a.amount);
  const payees = [...pay].map(([name, v]) => {
    const ts = v.ts.slice().sort((a, b) => a - b);
    const every = ts.length > 1 ? Math.round((ts[ts.length - 1] - ts[0]) / DAY / (ts.length - 1)) : 0;
    return { name: title(name), count: ts.length, total: Math.round(v.total), avg: Math.round(v.total / ts.length), everyDays: every };
  }).sort((a, b) => b.total - a.total).slice(0, opts.maxPayees ?? 8);
  return { total: Math.round(total), count: out.length, categories, payees };
}

/** "ogni 3 giorni", "ogni settimana", "una volta" — a parole, per chi non ama i numeri. */
export function everyText(days: number, count: number): string {
  if (count < 2) return t('una volta');
  if (days <= 1) return t('quasi ogni giorno');
  if (days <= 4) return t('ogni {0} giorni', days);
  if (days <= 9) return t('ogni settimana');
  if (days <= 17) return t('ogni due settimane');
  if (days <= 45) return t('ogni mese');
  return t('raramente');
}
