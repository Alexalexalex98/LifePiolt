/**
 * Piano del mese (modulo PURO, niente AI nei numeri): entrata prevista (stipendio fisso, a ore, a percentuale, con straordinari),
 * meno le spese fisse (dall'estratto, modificabili), meno i soldi da mettere da parte (obiettivi, dilazioni di fatture grosse).
 * Quello che resta è da vivere. Tutto si può correggere a mano; ciò che l'app non sa, lo chiede.
 */
import { payeeKey } from './statementAnalysis.ts';

export type IncomeMode = 'fixed' | 'hourly' | 'commission';
export type IncomeModel = {
  mode: IncomeMode;
  /** stipendio mensile netto (fixed) o parte fissa (commission) */
  amount?: number;
  /** a ore: ore del mese e paga oraria netta */
  hours?: number; rate?: number;
  /** straordinari: ore e paga oraria */
  overtimeHours?: number; overtimeRate?: number;
  /** a percentuale: incasso su cui si calcola e percentuale */
  revenue?: number; pct?: number;
  /** tredicesima/bonus mensilizzati, se ci sono */
  extra?: number;
  /** quanto arriverà davvero il mese prossimo, se l'utente lo sa: vince su tutto */
  manualNext?: number;
};
export type IncomeEstimate = { total: number; lines: { label: string; amount: number }[]; manual: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;
const pos = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

export function estimateIncome(m: IncomeModel | null | undefined): IncomeEstimate {
  if (!m) return { total: 0, lines: [], manual: false };
  if (pos(m.manualNext)) return { total: r2(m.manualNext!), lines: [{ label: 'Importo che hai indicato per il mese prossimo', amount: r2(m.manualNext!) }], manual: true };
  const lines: { label: string; amount: number }[] = [];
  if (m.mode === 'fixed') lines.push({ label: 'Stipendio fisso', amount: pos(m.amount) });
  if (m.mode === 'hourly') lines.push({ label: `Ore lavorate (${pos(m.hours)} × ${pos(m.rate)})`, amount: pos(m.hours) * pos(m.rate) });
  if (m.mode === 'commission') {
    if (pos(m.amount)) lines.push({ label: 'Parte fissa', amount: pos(m.amount) });
    lines.push({ label: `Percentuale (${pos(m.pct)}% di ${pos(m.revenue)})`, amount: (pos(m.revenue) * pos(m.pct)) / 100 });
  }
  if (pos(m.overtimeHours) && pos(m.overtimeRate)) lines.push({ label: `Straordinari (${pos(m.overtimeHours)} × ${pos(m.overtimeRate)})`, amount: pos(m.overtimeHours) * pos(m.overtimeRate) });
  if (pos(m.extra)) lines.push({ label: 'Tredicesima / bonus (quota mensile)', amount: pos(m.extra) });
  const L = lines.filter((l) => l.amount > 0).map((l) => ({ label: l.label, amount: r2(l.amount) }));
  return { total: r2(L.reduce((a, l) => a + l.amount, 0)), lines: L, manual: false };
}

/* ------------------------------------------------------------------ dilazioni */
export type Installment = { ym: string; amount: number };
const addMonths = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number) as [number, number]; const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export { addMonths };

/** Divide un importo su N mesi (l'ultimo mese prende il resto dei centesimi). */
export function spreadOver(total: number, months: number, startYm: string): Installment[] {
  const n = Math.max(1, Math.round(months));
  const base = Math.floor((total / n) * 100) / 100;
  const out: Installment[] = Array.from({ length: n }, (_, i) => ({ ym: addMonths(startYm, i), amount: base }));
  out[n - 1]!.amount = r2(total - base * (n - 1));
  return out;
}
/** «Per il tempo necessario»: quanti mesi servono per pagare `total` mettendo da parte `perMonth` al mese. */
export const monthsNeeded = (total: number, perMonth: number) => (perMonth > 0 ? Math.ceil(total / perMonth - 1e-9) : Infinity);

export type PaymentPlan = { id: string; name: string; total: number; startYm: string; months: number };
export const planInstallment = (p: PaymentPlan, ym: string): number => spreadOver(p.total, p.months, p.startYm).find((x) => x.ym === ym)?.amount ?? 0;

/* ------------------------------------------------------------------ obiettivi di risparmio */
export type SaveGoal = { id: string; name: string; kind: 'vacation' | 'purchase' | 'other'; total: number; targetYm: string; saved?: number };
/** Quanto mettere da parte questo mese per arrivare alla cifra entro il mese scelto. */
export function goalMonthly(g: SaveGoal, ym: string): number {
  const left = Math.max(0, g.total - (g.saved ?? 0));
  const [y1, m1] = ym.split('-').map(Number) as [number, number], [y2, m2] = g.targetYm.split('-').map(Number) as [number, number];
  const months = Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
  return r2(left / months);
}

/* ------------------------------------------------------------------ il piano */
export type PlanLine = { label: string; amount: number };
export type MonthPlan = {
  income: IncomeEstimate;
  fixed: PlanLine[]; fixedTotal: number;
  setAside: PlanLine[]; setAsideTotal: number;
  /** quello che resta da vivere nel mese, dopo spese fisse e soldi da mettere da parte */
  free: number;
  perDay: number;
  status: 'ok' | 'stretto' | 'in-rosso' | 'senza-entrata';
};
export function buildMonthPlan(a: { ym: string; income: IncomeModel | null; fixed: PlanLine[]; goals: SaveGoal[]; plans: PaymentPlan[]; daysLeft: number }): MonthPlan {
  const income = estimateIncome(a.income);
  const fixed = a.fixed.filter((x) => x.amount > 0);
  const setAside: PlanLine[] = [
    ...a.goals.map((g) => ({ label: g.name, amount: goalMonthly(g, a.ym) })),
    ...a.plans.map((p) => ({ label: `${p.name} (rata)`, amount: planInstallment(p, a.ym) })),
  ].filter((x) => x.amount > 0);
  const fixedTotal = r2(fixed.reduce((s, x) => s + x.amount, 0)), setAsideTotal = r2(setAside.reduce((s, x) => s + x.amount, 0));
  const free = r2(income.total - fixedTotal - setAsideTotal);
  const status = income.total <= 0 ? 'senza-entrata' : free < 0 ? 'in-rosso' : free < income.total * 0.1 ? 'stretto' : 'ok';
  return { income, fixed, fixedTotal, setAside, setAsideTotal, free, perDay: a.daysLeft > 0 ? r2(free / a.daysLeft) : 0, status };
}

/* ------------------------------------------------------------------ cose da chiedere all'utente */
export type Row = { date: string; label: string; amount: number };
const median = (v: number[]) => { const s = [...v].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2) : 0; };

/** Fatture/pagamenti troppo alti rispetto al solito o all'entrata: se ne chiede il motivo e si propone di dilazionarli. */
export function detectLumpy(rows: Row[], monthlyIncome: number): { date: string; label: string; amount: number; reason: 'sopra-il-solito' | 'pesa-sull-entrata' }[] {
  const out: { date: string; label: string; amount: number; reason: 'sopra-il-solito' | 'pesa-sull-entrata' }[] = [];
  const byPayee = new Map<string, Row[]>();
  rows.filter((r) => r.amount < 0).forEach((r) => { const k = payeeKey(r.label); byPayee.set(k, [...(byPayee.get(k) ?? []), r]); });
  for (const [, list] of byPayee) {
    const med = median(list.map((r) => -r.amount));
    for (const r of list) {
      const a = -r.amount;
      if (list.length >= 3 && a >= med * 2.5 && a >= 150) out.push({ date: r.date, label: r.label, amount: r.amount, reason: 'sopra-il-solito' });
      else if (list.length < 3 && monthlyIncome > 0 && a >= monthlyIncome * 0.35 && a >= 400) out.push({ date: r.date, label: r.label, amount: r.amount, reason: 'pesa-sull-entrata' });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Stesso importo, stesso beneficiario, stessa data, almeno due volte: doppio addebito o errore di lettura. */
export function detectDuplicates(rows: Row[]): { key: string; label: string; date: string; amount: number; count: number }[] {
  const g = new Map<string, Row[]>();
  rows.filter((r) => r.amount < 0).forEach((r) => { const k = `${r.date}|${payeeKey(r.label)}|${r.amount}`; g.set(k, [...(g.get(k) ?? []), r]); });
  return [...g.entries()].filter(([, l]) => l.length >= 2).map(([key, l]) => ({ key, label: l[0]!.label, date: l[0]!.date, amount: l[0]!.amount, count: l.length }));
}

/** Entrate che sembrano il rimborso di una spesa recente dello stesso beneficiario (entro 90 giorni, importo non superiore). */
export function matchRefunds(rows: Row[]): { credit: Row; debit: Row }[] {
  const out: { credit: Row; debit: Row }[] = [];
  const debits = rows.filter((r) => r.amount < 0);
  for (const c of rows.filter((r) => r.amount > 0)) {
    const k = payeeKey(c.label); if (k.length < 3) continue;
    const hit = debits.filter((d) => payeeKey(d.label) === k && -d.amount >= c.amount * 0.999 && d.date <= c.date && (Date.parse(c.date) - Date.parse(d.date)) / 86400000 <= 90).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (hit) out.push({ credit: c, debit: hit });
  }
  return out;
}

/** I soldi da mettere da parte sono davvero stati spostati? Cerca nel mese un'uscita (o un giroconto) di quell'importo (±5%). */
export function findSavingsMove(rows: Row[], amount: number, hint?: string): Row | null {
  if (amount <= 0) return null;
  const tol = Math.max(10, amount * 0.05);
  const h = hint?.trim().toLowerCase();
  return rows.find((r) => r.amount < 0 && Math.abs(-r.amount - amount) <= tol && (!h || r.label.toLowerCase().includes(h) || /giro|trasfer|risparm|spar|ueberweis|versament/i.test(r.label))) ?? null;
}
/** Un movimento grande che coincide con la cifra da mettere da parte ma non era previsto: chiedere se è per quello. */
export function unexpectedSavingsLike(rows: Row[], amount: number, expectedAt: string[]): Row[] {
  const tol = Math.max(10, amount * 0.05);
  return rows.filter((r) => Math.abs(Math.abs(r.amount) - amount) <= tol && !expectedAt.includes(r.date));
}
