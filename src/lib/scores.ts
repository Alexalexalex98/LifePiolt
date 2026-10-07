import { avg, clamp } from '@/lib/format';
import { last, useHealth } from '@/store/health';
import { monthNet, useFin } from '@/store/finance';
import { useLife } from '@/store/life';

export type Scores = { health: number | null; mind: number | null; finance: number | null; growth: number | null; total: number | null };

export function savingsRatePct(): number | null {
  const m = useFin.getState().months[0];
  if (!m) return null;
  const income = m.movements.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0);
  if (income <= 0) return null;
  return Math.max(0, (monthNet(m) / income) * 100);
}

export function computeScores(): Scores {
  const h = useHealth.getState();
  const sleep = last(h.series.sleep), steps = last(h.series.steps), stress = last(h.series.stress);
  const parts: number[] = [];
  if (sleep != null) parts.push(Math.min(100, (sleep / 8) * 100));
  if (steps != null) parts.push(Math.min(100, (steps / 10000) * 100));
  if (stress != null) parts.push(100 - stress);
  const health = parts.length ? Math.round(avg(parts)) : null;

  let mind: number | null = null;
  if (stress != null) mind = Math.round(h.moods.length ? 100 - stress : (100 - stress) * 0.9);

  const sr = savingsRatePct();
  const finance = sr == null ? null : Math.min(100, Math.round((sr / 20) * 100));

  const goals = useLife.getState().goals;
  const growth = goals.length ? Math.round(avg(goals.map((g) => g.p))) : null;

  const vals = [health, mind, finance, growth].filter((v): v is number => v != null);
  return { health, mind, finance, growth, total: vals.length ? Math.round(avg(vals)) : null };
}

export const score01 = (v: number | null) => (v == null ? 0 : clamp(v, 0, 100));
