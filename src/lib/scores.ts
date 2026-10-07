import { computeDashboard } from '@/lib/analyticsData';
import { monthNet, useFin } from '@/store/finance';

export type Scores = { health: number | null; mind: number | null; finance: number | null; growth: number | null; total: number | null };

export function savingsRatePct(): number | null {
  const m = useFin.getState().months[0];
  if (!m) return null;
  const income = m.movements.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0);
  if (income <= 0) return null;
  return Math.max(0, (monthNet(m) / income) * 100);
}

/** Punteggi calcolati dal motore di analisi (aderenza agli obiettivi negli ultimi 7 giorni / ultimo mese). */
export function computeScores(): Scores {
  const d = computeDashboard().scores;
  return { health: d.salute, mind: d.mente, finance: d.finanza, growth: d.crescita, total: d.total };
}
