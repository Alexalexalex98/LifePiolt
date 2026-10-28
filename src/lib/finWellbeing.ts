import { t } from '../i18n/core.ts';

/** Benessere finanziario 0-100: come ti stai comportando con i soldi, non quanti ne hai. Modulo PURO e testabile. */

export type WbMonth = { income: number; expense: number };
export type WbInput = {
  /** mesi chiusi o in corso, dal piu' recente; basta quello che c'e' (max 6 contano) */
  months: WbMonth[];
  /** mese in corso: speso fino a oggi e budget previsto (null se non c'e' un budget) */
  budget: { planned: number; spent: number } | null;
  /** entrata ricorrente e spese fisse del mese (0 se ignote) */
  salary: number;
  fixed: number;
  bills: { overdue: number; paidLate: number; paidOnTime: number };
};
export type WbFactorId = 'risparmio' | 'budget' | 'bollette' | 'stabilita' | 'fisse';
export type WbFactor = { id: WbFactorId; label: string; weight: number; score: number; value: string; tip: string };
export type WbResult = { score: number; level: 'ottimo' | 'buono' | 'attenzione' | 'critico'; factors: WbFactor[]; missing: WbFactorId[] };

const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const lin = (x: number, x0: number, x1: number) => clamp(((x - x0) / (x1 - x0)) * 100); // x0 -> 0, x1 -> 100
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function finWellbeing(inp: WbInput): WbResult {
  const ms = inp.months.filter((m) => m.income > 0 || m.expense > 0).slice(0, 6);
  const factors: WbFactor[] = [];
  const missing: WbFactorId[] = [];

  const withIncome = ms.filter((m) => m.income > 0);
  if (withIncome.length) {
    const inc = withIncome.reduce((s, m) => s + m.income, 0), exp = withIncome.reduce((s, m) => s + m.expense, 0);
    const rate = (inc - exp) / inc;
    factors.push({ id: 'risparmio', label: 'Risparmio', weight: 30, score: Math.round(lin(rate, 0, 0.2)), value: t('metti da parte il {0} di ciò che entra', pct(Math.max(rate, 0))), tip: rate >= 0.2 ? 'Ottimo: sei oltre il 20% consigliato.' : rate >= 0 ? 'Punta al 10-20% delle entrate: parti da una piccola cifra fissa a inizio mese.' : 'Spendi più di quanto entra: guarda dove vanno i soldi e taglia la voce più pesante non essenziale.' });
  } else missing.push('risparmio');

  if (inp.budget && inp.budget.planned > 0) {
    const r = inp.budget.spent / inp.budget.planned;
    factors.push({ id: 'budget', label: 'Budget del mese', weight: 25, score: Math.round(100 - lin(r, 1, 1.3)), value: t('hai usato il {0} del budget', pct(r)), tip: r <= 1 ? 'Sei dentro il budget del mese.' : 'Hai superato il budget: controlla le categorie in rosso.' });
  } else missing.push('budget');

  const nb = inp.bills.overdue + inp.bills.paidLate + inp.bills.paidOnTime;
  if (nb > 0) {
    const s = clamp(100 - inp.bills.overdue * 40 - inp.bills.paidLate * 10);
    factors.push({ id: 'bollette', label: 'Bollette puntuali', weight: 20, score: s, value: inp.bills.overdue ? t(inp.bills.overdue === 1 ? '{0} scaduta da pagare' : '{0} scadute da pagare', inp.bills.overdue) : inp.bills.paidLate ? t('{0} pagate in ritardo', inp.bills.paidLate) : 'tutte pagate in tempo', tip: s >= 90 ? 'Paghi in tempo: continua così.' : 'Paga le scadute e attiva i promemoria per non perdere altre scadenze.' });
  } else missing.push('bollette');

  if (ms.length >= 3) {
    const e = ms.map((m) => m.expense), mean = e.reduce((s, x) => s + x, 0) / e.length;
    const cv = mean > 0 ? Math.sqrt(e.reduce((s, x) => s + (x - mean) ** 2, 0) / e.length) / mean : 0;
    factors.push({ id: 'stabilita', label: 'Spese regolari', weight: 15, score: Math.round(100 - lin(cv, 0.1, 0.5)), value: cv < 0.15 ? 'le spese sono costanti da un mese all’altro' : 'le spese cambiano molto da un mese all’altro', tip: cv < 0.15 ? 'Prevedibile = più facile da pianificare.' : 'Mesi molto diversi di solito nascondono spese una tantum: segnale utile per il budget.' });
  } else missing.push('stabilita');

  if (inp.salary > 0 && inp.fixed > 0) {
    const r = inp.fixed / inp.salary;
    factors.push({ id: 'fisse', label: 'Peso delle spese fisse', weight: 10, score: Math.round(100 - lin(r, 0.5, 0.8)), value: t('le spese fisse sono il {0} delle entrate', pct(r)), tip: r <= 0.5 ? 'Hai molto margine di manovra.' : 'Sopra il 50% resta poco spazio per imprevisti e risparmio.' });
  } else missing.push('fisse');

  const w = factors.reduce((s, f) => s + f.weight, 0);
  const score = w ? Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0) / w) : 0;
  const level = score >= 80 ? 'ottimo' : score >= 60 ? 'buono' : score >= 40 ? 'attenzione' : 'critico';
  return { score, level, factors, missing };
}

export const WB_LEVEL: Record<WbResult['level'], string> = { ottimo: 'Ottimo', buono: 'Buono', attenzione: 'Da migliorare', critico: 'Critico' };
