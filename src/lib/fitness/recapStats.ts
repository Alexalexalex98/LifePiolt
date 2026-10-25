import { dayOf, displayName, slotOf, type DayMeal } from './mealInsights.ts';

export type Slot = 'colazione' | 'pranzo' | 'merenda' | 'cena' | 'notte';
export type Recap = {
  /** giorni con almeno un pasto registrato */ logged: number; /** giorni del periodo */ span: number;
  meals: number; kcal: number; avgKcal: number; mealsPerDay: number;
  /** giorno con più e con meno calorie tra quelli registrati */ top?: { key: string; kcal: number }; low?: { key: string; kcal: number };
  /** quota di giorni registrati con calorie tra 90% e 110% dell'obiettivo (0-1) */ onTarget?: number;
  /** giorni consecutivi con pasti registrati fino a oggi (o ieri) */ streak: number;
  /** ripartizione delle calorie tra proteine, carboidrati, grassi (0-1) */ split: { p: number; c: number; f: number };
  slots: { id: Slot; kcal: number; share: number }[];
  foods: { name: string; count: number; kcal: number }[];
  junkShare: number; sugarAvg: number; fibreAvg: number; sugarDaysOver: number;
  series: { label: string; kcal: number }[];
  /** differenza percentuale delle calorie medie rispetto al periodo precedente di pari durata */ delta?: number;
};

const DAY = 86400000;
const startOf = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const SLOTS: Slot[] = ['colazione', 'pranzo', 'merenda', 'cena', 'notte'];

function avgLogged(meals: DayMeal[]): number {
  const by = new Map<string, number>();
  for (const m of meals) by.set(dayOf(m.ts), (by.get(dayOf(m.ts)) ?? 0) + m.macros.kcal);
  return by.size ? [...by.values()].reduce((a, b) => a + b, 0) / by.size : 0;
}

/** Statistiche di un periodo che finisce a `now` e dura `days` giorni (1 = solo oggi). `sugarMax` e `targetKcal` dai valori di riferimento. */
export function recap(all: DayMeal[], now: number, days: number, o: { targetKcal?: number; sugarMax?: number } = {}): Recap {
  const end = startOf(now) + DAY;
  const from = end - days * DAY;
  const list = all.filter((m) => m.ts >= from && m.ts < end);
  const byDay = new Map<string, DayMeal[]>();
  for (const m of list) byDay.set(dayOf(m.ts), [...(byDay.get(dayOf(m.ts)) ?? []), m]);
  const dayKcal = [...byDay.entries()].map(([key, ms]) => ({ key, kcal: Math.round(ms.reduce((a, m) => a + m.macros.kcal, 0)), sug: ms.reduce((a, m) => a + (m.macros.sug ?? 0), 0), fib: ms.reduce((a, m) => a + (m.macros.fib ?? 0), 0) }));
  const logged = dayKcal.length;
  const kcal = dayKcal.reduce((a, d) => a + d.kcal, 0);
  const sum = (k: 'p' | 'c' | 'f') => list.reduce((a, m) => a + (m.macros[k] ?? 0), 0);
  const pk = sum('p') * 4, ck = sum('c') * 4, fk = sum('f') * 9, tk = pk + ck + fk || 1;
  const slotK = new Map<Slot, number>();
  for (const m of list) slotK.set(slotOf(m.ts), (slotK.get(slotOf(m.ts)) ?? 0) + m.macros.kcal);
  const foodMap = new Map<string, { count: number; kcal: number }>();
  for (const m of list) { const n = displayName(m).trim(); if (!n) continue; const k = n.toLowerCase(); const c = foodMap.get(k) ?? { count: 0, kcal: 0 }; foodMap.set(k, { count: c.count + 1, kcal: c.kcal + m.macros.kcal }); }
  const nameOf = new Map<string, string>(); for (const m of list) nameOf.set(displayName(m).trim().toLowerCase(), displayName(m).trim());
  const foods = [...foodMap.entries()].map(([k, v]) => ({ name: nameOf.get(k) ?? k, count: v.count, kcal: Math.round(v.kcal / v.count) })).sort((a, b) => b.count - a.count || b.kcal - a.kcal).slice(0, 5);
  const sorted = [...dayKcal].sort((a, b) => b.kcal - a.kcal);
  const tgt = o.targetKcal;
  let streak = 0;
  { const has = new Set(all.map((m) => dayOf(m.ts))); let t = startOf(now); if (!has.has(dayOf(t))) t -= DAY; while (has.has(dayOf(t))) { streak++; t -= DAY; } }
  /* serie: giorno per giorno fino a 31 giorni, poi media dei giorni registrati per mese */
  let series: Recap['series'];
  if (days <= 31) {
    const n = Math.max(1, days);
    series = Array.from({ length: n }, (_, i) => { const ts = from + i * DAY; const d = byDay.get(dayOf(ts)); return { label: String(new Date(ts).getDate()), kcal: d ? Math.round(d.reduce((a, m) => a + m.macros.kcal, 0)) : 0 }; });
  } else {
    const months = new Map<string, number[]>();
    for (const d of dayKcal) { const k = d.key.slice(0, 7); months.set(k, [...(months.get(k) ?? []), d.kcal]); }
    series = [...months.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-12).map(([k, v]) => ({ label: k.slice(5), kcal: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }));
  }
  const prev = all.filter((m) => m.ts >= from - days * DAY && m.ts < from);
  const pa = avgLogged(prev), ca = logged ? kcal / logged : 0;
  return {
    logged, span: days, meals: list.length, kcal, avgKcal: logged ? Math.round(kcal / logged) : 0, mealsPerDay: logged ? Math.round((list.length / logged) * 10) / 10 : 0,
    top: sorted[0], low: logged > 1 ? sorted[sorted.length - 1] : undefined,
    onTarget: tgt && logged ? dayKcal.filter((d) => d.kcal >= tgt * 0.9 && d.kcal <= tgt * 1.1).length / logged : undefined,
    streak, split: { p: pk / tk, c: ck / tk, f: fk / tk },
    slots: SLOTS.map((id) => ({ id, kcal: Math.round(slotK.get(id) ?? 0), share: kcal ? (slotK.get(id) ?? 0) / kcal : 0 })),
    foods,
    junkShare: kcal ? Math.min(1, list.reduce((a, m) => a + (m.junkKcal ?? 0), 0) / kcal) : 0,
    sugarAvg: logged ? Math.round((dayKcal.reduce((a, d) => a + d.sug, 0) / logged) * 10) / 10 : 0,
    fibreAvg: logged ? Math.round((dayKcal.reduce((a, d) => a + d.fib, 0) / logged) * 10) / 10 : 0,
    sugarDaysOver: o.sugarMax ? dayKcal.filter((d) => d.sug > o.sugarMax!).length : 0,
    series, delta: pa > 0 && ca > 0 ? Math.round(((ca - pa) / pa) * 100) : undefined,
  };
}
