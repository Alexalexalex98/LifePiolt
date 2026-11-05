/** Amministrazione e soldi (modulo PURO, nessun alias '@/'): cassa, prima nota, budget, abbonamenti, scadenze fiscali di Italia e Svizzera, pacchetto per il commercialista. */
export type Currency = 'CHF' | 'EUR';
export type Entry = { id: string; team_id: string; day: string; kind: 'in' | 'out'; category: string; description: string; amount: number; currency: Currency; project: string | null; doc_id: string | null };
export type Expense = { id: string; team_id: string; user_id: string; day: string; category: string; description: string; amount: number; currency: Currency; project: string | null; receipt_path: string | null; status: 'submitted' | 'approved' | 'rejected' | 'paid'; note: string };
export type Budget = { id: string; team_id: string; project: string | null; category: string; period: string; amount: number; currency: Currency };
export type Sub = { id: string; team_id: string; name: string; vendor: string; category: string; amount: number; currency: Currency; cycle: 'month' | 'quarter' | 'year'; next_date: string | null; active: boolean };

export const CATEGORIES_OUT = ['Affitto', 'Stipendi e contributi', 'Fornitori', 'Utenze', 'Trasferte', 'Marketing', 'Consulenze', 'Assicurazioni', 'Imposte e tasse', 'Abbonamenti', 'Materiale d\'ufficio', 'Altro'];
export const CATEGORIES_IN = ['Vendite', 'Servizi', 'Rimborsi', 'Altro'];
export const EXPENSE_CATEGORIES = ['Trasferta', 'Pasti', 'Carburante', 'Hotel', 'Materiale', 'Formazione', 'Rappresentanza', 'Altro'];
const r2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthOf = (day: string) => day.slice(0, 7);

/** Entrate, uscite e saldo di cassa (per valuta). */
export function balance(entries: Entry[], currency: Currency, upTo?: string): { inn: number; out: number; net: number } {
  const l = entries.filter((e) => e.currency === currency && (!upTo || e.day <= upTo));
  const inn = r2(l.filter((e) => e.kind === 'in').reduce((a, e) => a + e.amount, 0)), out = r2(l.filter((e) => e.kind === 'out').reduce((a, e) => a + e.amount, 0));
  return { inn, out, net: r2(inn - out) };
}
export const inMonth = (entries: Entry[], month: string) => entries.filter((e) => monthOf(e.day) === month);
export function byCategory(entries: Entry[], kind: 'in' | 'out', currency: Currency): { category: string; total: number }[] {
  const m = new Map<string, number>(); for (const e of entries) if (e.kind === kind && e.currency === currency) m.set(e.category, r2((m.get(e.category) ?? 0) + e.amount));
  return [...m.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}
/** Budget contro speso. Il budget di un mese conta per quel mese, quello di un anno per tutto l'anno; si somma solo ciò che è uscito. */
export function budgetStatus(budgets: Budget[], entries: Entry[], period: string, currency: Currency, project?: string | null): { category: string; budget: number; spent: number; pct: number; over: boolean }[] {
  const rel = budgets.filter((b) => b.currency === currency && (b.period === period || b.period === period.slice(0, 4)) && (project === undefined || b.project === project));
  const cats = [...new Set(rel.map((b) => b.category))];
  return cats.map((category) => {
    const budget = r2(rel.filter((b) => b.category === category).reduce((a, b) => a + b.amount, 0));
    const spent = r2(entries.filter((e) => e.kind === 'out' && e.currency === currency && e.category === category && e.day.startsWith(period) && (project === undefined || e.project === project)).reduce((a, e) => a + e.amount, 0));
    return { category, budget, spent, pct: budget ? Math.round((spent / budget) * 100) : spent ? 999 : 0, over: spent > budget };
  }).sort((a, b) => b.pct - a.pct);
}

/* ---------- abbonamenti e contratti ---------- */
export const monthlyCost = (s: Pick<Sub, 'amount' | 'cycle'>): number => r2(s.cycle === 'month' ? s.amount : s.cycle === 'quarter' ? s.amount / 3 : s.amount / 12);
export const subsMonthly = (subs: Sub[], currency: Currency): number => r2(subs.filter((s) => s.active && s.currency === currency).reduce((a, s) => a + monthlyCost(s), 0));
const step = (day: string, cycle: Sub['cycle']): string => { const d = new Date(day + 'T12:00:00'); const dom = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + (cycle === 'month' ? 1 : cycle === 'quarter' ? 3 : 12)); d.setDate(Math.min(dom, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); };
/** Il prossimo addebito: porta avanti la data di un ciclo alla volta finché non è oggi o dopo. */
export function nextCharge(s: Pick<Sub, 'next_date' | 'cycle'>, today: string): string | null { if (!s.next_date) return null; let d = s.next_date, n = 0; while (d < today && n++ < 400) d = step(d, s.cycle); return d; }
export const subsDue = (subs: Sub[], today: string, days = 30): { sub: Sub; day: string }[] => {
  const limit = new Date(today + 'T12:00:00'); limit.setDate(limit.getDate() + days); const lim = iso(limit);
  return subs.filter((s) => s.active).map((sub) => ({ sub, day: nextCharge(sub, today) })).filter((x): x is { sub: Sub; day: string } => !!x.day && x.day <= lim).sort((a, b) => a.day.localeCompare(b.day));
};

/* ---------- scadenze fiscali ---------- */
export type TaxDate = { day: string; title: string; country: 'IT' | 'CH' };
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
/** Le scadenze più comuni dell'anno. Sono indicative: le date cambiano per regime, cantone e anno, quindi vanno confermate con il commercialista o la cassa. */
export function taxDeadlines(country: 'IT' | 'CH', year: number, o: { vat?: 'month' | 'quarter' } = {}): TaxDate[] {
  const d = (m: number, day: number) => `${year}-${pad(m)}-${pad(Math.min(day, lastDay(year, m)))}`; const out: TaxDate[] = [];
  if (country === 'IT') {
    if ((o.vat ?? 'month') === 'month') for (let m = 1; m <= 12; m++) out.push({ day: d(m, 16), title: `Liquidazione e versamento IVA (mese precedente)`, country });
    else for (const [m, t] of [[2, 'IVA 4° trimestre anno prima'], [5, 'IVA 1° trimestre'], [8, 'IVA 2° trimestre'], [11, 'IVA 3° trimestre']] as const) out.push({ day: d(m, m === 8 ? 20 : 16), title: `Versamento ${t}`, country });
    for (let m = 1; m <= 12; m++) out.push({ day: d(m, 16), title: 'F24: ritenute e contributi INPS', country });
    out.push({ day: d(3, 16), title: 'Certificazione Unica ai dipendenti', country }, { day: d(4, 30), title: 'Dichiarazione IVA annuale', country }, { day: d(6, 30), title: 'Primo acconto imposte', country }, { day: d(10, 31), title: 'Modello 770', country }, { day: d(11, 30), title: 'Secondo acconto imposte e dichiarazione dei redditi', country });
  } else {
    out.push({ day: d(1, 31), title: 'Certificato di salario ai dipendenti', country }, { day: d(2, year % 4 === 0 ? 29 : 28), title: 'IVA 4° trimestre anno prima (60 giorni)', country }, { day: d(5, 31), title: 'IVA 1° trimestre (60 giorni)', country }, { day: d(8, 31), title: 'IVA 2° trimestre (60 giorni)', country }, { day: d(11, 30), title: 'IVA 3° trimestre (60 giorni)', country });
    for (const m of [1, 4, 7, 10]) out.push({ day: d(m, 10), title: 'Acconto contributi AVS/AI/IPG (trimestre)', country });
    out.push({ day: d(3, 31), title: 'Dichiarazione delle imposte (verifica il termine del tuo cantone)', country });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}
export const taxSoon = (list: TaxDate[], today: string, days = 45): TaxDate[] => { const lim = new Date(today + 'T12:00:00'); lim.setDate(lim.getDate() + days); const l = iso(lim); return list.filter((t) => t.day >= today && t.day <= l); };

/* ---------- note spese ---------- */
export function expenseTotals(l: Expense[], currency: Currency): { submitted: number; approved: number; paid: number } {
  const s = (st: Expense['status']) => r2(l.filter((e) => e.currency === currency && e.status === st).reduce((a, e) => a + e.amount, 0));
  return { submitted: s('submitted'), approved: s('approved'), paid: s('paid') };
}

/* ---------- commercialista ---------- */
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const num = (n: number) => n.toFixed(2).replace('.', ',');
/** La prima nota del mese in CSV, con le note spese approvate o pagate: il file da mandare al commercialista. */
export function accountantCsv(entries: Entry[], expenses: Expense[], month: string): string {
  const rows = [...inMonth(entries, month).map((e) => [e.day, e.kind === 'in' ? 'Entrata' : 'Uscita', e.category, e.description, num(e.amount), e.currency, e.doc_id ? 'documento collegato' : '']), ...expenses.filter((e) => monthOf(e.day) === month && (e.status === 'approved' || e.status === 'paid')).map((e) => [e.day, 'Nota spese', e.category, e.description, num(e.amount), e.currency, e.receipt_path ? 'scontrino allegato' : ''])].sort((a, b) => a[0]!.localeCompare(b[0]!));
  return ['﻿Data;Tipo;Categoria;Descrizione;Importo;Valuta;Documento', ...rows.map((r) => r.map((c, i) => (i === 3 || i === 2 ? q(c!) : c)).join(';'))].join('\r\n');
}
export function accountantSummary(entries: Entry[], expenses: Expense[], month: string, currency: Currency): string {
  const m = inMonth(entries, month); const b = balance(m, currency); const ex = expenses.filter((e) => monthOf(e.day) === month && e.currency === currency && (e.status === 'approved' || e.status === 'paid'));
  const cats = byCategory(m, 'out', currency);
  return [`Prima nota ${month}`, '', `Entrate: ${num(b.inn)} ${currency}`, `Uscite: ${num(b.out)} ${currency}`, `Saldo del mese: ${num(b.net)} ${currency}`, '', ...(cats.length ? ['Uscite per categoria', ...cats.map((c) => `- ${c.category}: ${num(c.total)} ${currency}`), ''] : []), ...(ex.length ? [`Note spese approvate o pagate: ${ex.length} per ${num(r2(ex.reduce((a, e) => a + e.amount, 0)))} ${currency}`, ''] : []), 'I documenti sono nell\'archivio del workspace.'].join('\n');
}
/** Fatture e bollette ancora da pagare: totale e quanto è già scaduto (dai documenti caricati). */
export function toPay(docs: { kind: string; status: string; amount: number | null; currency: Currency | null; due: string | null }[], today: string): Record<Currency, { open: number; late: number; count: number }> {
  const out: Record<Currency, { open: number; late: number; count: number }> = { CHF: { open: 0, late: 0, count: 0 }, EUR: { open: 0, late: 0, count: 0 } };
  for (const d of docs) if ((d.kind === 'invoice' || d.kind === 'bill') && d.status === 'new' && d.amount != null && d.currency) { const o = out[d.currency]; o.open = r2(o.open + d.amount); o.count++; if (d.due && d.due < today) o.late = r2(o.late + d.amount); }
  return out;
}
