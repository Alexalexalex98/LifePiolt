/**
 * Dati di allenamento e alimentazione per il Life Score (modulo PURO): due serie giornaliere che entrano nell'area Salute,
 * così il punteggio tiene conto di quanto ti alleni davvero e di quanto mangi bene.
 */
import { groupByDay, dayStats, quality, type Targets } from './mealInsights.ts';
import { withMicro, type StoredMeal } from './mealMicro.ts';

export type Pt = { d: string; v: number };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (day: string, n: number) => { const [y, m, d] = day.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };

/** Obiettivo generico di un adulto, usato se non hai ancora inserito i tuoi dati. */
export const DEFAULT_TARGETS: Targets = { kcal: 2000, protein: 60, carbs: 250, fat: 67, fibre: 28, sugarMax: 50, satMax: 22, saltMax: 5 };

/**
 * Allenamenti degli ultimi `span` giorni: 1 nei giorni in cui hai fatto una sessione, 0 negli altri. L'obiettivo giornaliero è
 * `giorniAllaSettimana / 7`: se ti alleni quanto previsto la media dei 7 giorni lo raggiunge, se non ti alleni per niente vale 0.
 * Senza un programma né allenamenti registrati non c'è nessun dato (non penalizza chi non usa LifeFitness).
 */
export function trainingSeries(history: { date: string }[], daysPerWeek: number | undefined, today: string, span = 28): { pts: Pt[]; target: number } | null {
  if (!history.length && !daysPerWeek) return null;
  const perWeek = Math.max(1, Math.min(7, daysPerWeek ?? 3));
  const done = new Set(history.map((w) => w.date));
  const pts: Pt[] = [];
  for (let i = span - 1; i >= 0; i--) { const d = addDays(today, -i); pts.push({ d, v: done.has(d) ? 1 : 0 }); }
  return { pts, target: perWeek / 7 };
}

/** Qualità dell'alimentazione (0-100) per ogni giorno con pasti: il giorno in corso conta solo dopo le 20. */
export function dietSeries(meals: StoredMeal[], water: Record<string, number>, targets: Targets | null, today: string, hourNow: number): Pt[] {
  const tg = targets ?? DEFAULT_TARGETS;
  const out: Pt[] = [];
  for (const g of groupByDay(withMicro(meals))) {
    if (g.key === today && hourNow < 20) continue;
    const q = quality(dayStats(g, water[g.key]), tg);
    if (q) out.push({ d: g.key, v: q.score });
  }
  return out.sort((a, b) => a.d.localeCompare(b.d)).slice(-30);
}
