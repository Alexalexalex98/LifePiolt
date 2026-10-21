import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { MetricSheet } from '@/components/dashboard';
import { LifeScoreSheet } from '@/components/scoreSheet';

import { analyze, type Analysis as FinAnalysis } from '@/lib/financeRecap';
import { alertsFor } from '@/lib/budgetState';
import { useDashboard } from '@/lib/analyticsData';
import { categoryOf, emergencyByMonth, useFin } from '@/store/finance';

type Dash = ReturnType<typeof useDashboard>;
type Ctx = { dash: Dash; fin: FinAnalysis | null; openMetric: (id: string) => boolean; openScore: () => void };
const DashCtx = createContext<Ctx | null>(null);

/** I dati condivisi da tutti i widget: si calcolano una volta sola per tutta la pagina, non uno per widget. */
export function DashData({ children }: { children: ReactNode }) {
  const dash = useDashboard();
  const f = useFin();
  const fin = useMemo(() => {
    try {
      const now = new Date();
      const colors: Record<string, string> = {};
      f.categories.forEach((c) => { colors[c.n] = c.c; });
      const alerts = alertsFor(f).map((x) => ({ category: x.category, level: x.level, pct: x.pct }));
      return analyze({
        months: f.months, catOf: (l: string) => categoryOf(l, f.categories), catColors: colors,
        billsMonthly: f.bills.reduce((s, b) => s + (b.freq === 'monthly' ? b.amount : b.amount / 12), 0),
        efTotal: f.months.reduce((s, m) => s + emergencyByMonth(m), 0), alerts,
        day: now.getDate(), daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
      });
    } catch { return null; }
  }, [f.months, f.categories, f.bills, f.budget, f.guidelines]);
  const [metric, setMetric] = useState<string | null>(null);
  const [score, setScore] = useState(false);
  const v = useMemo(() => ({ dash, fin, openMetric: (id: string) => { if (!dash.byId[id]) return false; setMetric(id); return true; }, openScore: () => setScore(true) }), [dash, fin]);
  return (
    <DashCtx.Provider value={v}>
      {children}
      <MetricSheet a={metric ? dash.byId[metric] ?? null : null} onClose={() => setMetric(null)} />
      <LifeScoreSheet visible={score} onClose={() => setScore(false)} />
    </DashCtx.Provider>
  );
}

export function useDashData(): Ctx {
  const c = useContext(DashCtx);
  if (!c) throw new Error('DashData mancante');
  return c;
}
