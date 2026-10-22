import { alertsFor } from '@/lib/budgetState';
import { analyze } from '@/lib/financeRecap';
import { currentCurrency } from '@/i18n/format';
import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { dailyTarget, sumMacros } from '@/lib/fitness/nutrition';
import { categoryOf, emergencyByMonth, useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useShifts } from '@/store/shifts';
import type { Snap } from './core';

function finance(now: number): Snap['finance'] {
  try {
    const f = useFin.getState();
    if (!f.months.length) return null;
    const d = new Date(now);
    const colors: Record<string, string> = {};
    f.categories.forEach((c) => { colors[c.n] = c.c; });
    const alerts = alertsFor(f).map((x) => ({ category: x.category, level: x.level, pct: x.pct }));
    const a = analyze({
      months: f.months, catOf: (l: string) => categoryOf(l, f.categories), catColors: colors,
      billsMonthly: f.bills.reduce((s, b) => s + (b.freq === 'monthly' ? b.amount : b.amount / 12), 0),
      efTotal: f.months.reduce((s, m) => s + emergencyByMonth(m), 0), alerts,
      day: d.getDate(), daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    });
    if (!a.cur) return null;
    return {
      partial: a.partial, day: d.getDate(), daysInMonth: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
      income: a.cur.income, expense: a.cur.expense, saved: a.cur.saved, end: a.cur.end,
      projectionEnd: a.projection ? a.projection.end : null,
      over: alerts, topCats: a.donut.map((c) => ({ n: c.n, v: c.v })),
      label: a.cur.label, prev: a.prev ? { label: a.prev.label, income: a.prev.income, expense: a.prev.expense } : null,
      deltas: a.top.map((x) => ({ n: x.n, v: x.v, prev: x.prev })),
    };
  } catch { return null; }
}

function savings(): Snap['savings'] {
  try {
    const f = useFin.getState();
    const st = f.statementInfo;
    if (!st) return null;
    const sum = (l: { monthly: number }[]) => l.reduce((a, x) => a + x.monthly, 0);
    return { incomes: st.salary.sources.map((x) => ({ name: x.name, monthly: x.monthly })), fixed: sum(st.fixed), variable: sum(st.variable), vacation: f.vacation ?? null };
  } catch { return null; }
}

/** Una fotografia di ciò che l'app sa di te adesso, nel formato che Theia usa per rispondere e per il radar. */
export function collectSnap(now = Date.now()): Snap {
  const life = useLife.getState();
  const h = useHealth.getState();
  const fit = useFitness.getState();
  const series = (m: 'sleep' | 'steps') => {
    const v = h.series[m] ?? [], ds = h.dates?.[m] ?? [];
    return v.slice(-14).map((x, i, arr) => ({ day: ds[ds.length - arr.length + i] ?? '', v: x })).filter((p) => p.day);
  };
  const today = dayOf(now);
  const meals = fit.meals.filter((m) => dayOf(m.ts) === today);
  return {
    now,
    events: Object.fromEntries(Object.entries(life.events).map(([k, evs]) => [k, evs.map((e) => ({ time: e.time, title: e.title, dur: e.dur }))])),
    shifts: useShifts.getState().shifts,
    tasks: life.tasks.map((t) => ({ id: t.id, t: t.t, done: t.done, due: t.due, urgent: t.urgent })),
    finance: finance(now),
    savings: savings(),
    sleep: series('sleep').map((p) => ({ day: p.day, hours: p.v })),
    steps: series('steps').map((p) => ({ day: p.day, v: p.v })),
    water: Object.keys(fit.water ?? {}).length || fit.body ? { todayMl: (fit.water ?? {})[today] ?? 0, goalMl: waterGoal(fit.body?.weightKg) } : null,
    kcal: meals.length || fit.body ? { today: sumMacros(meals.map((m) => m.macros)).kcal, target: fit.body ? dailyTarget(fit.body) : null } : null,
    currency: currentCurrency(),
  };
}
