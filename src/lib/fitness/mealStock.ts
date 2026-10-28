/** Pasti del piano contro il frigo (modulo PURO e testabile): cosa manca per cucinare un pasto e quando avvisare. */
import { FOOD } from './nutrition.ts';
import { stockGrams, type PantryItem } from './pantry.ts';
import type { PlanDay, PlanMeal, Slot } from './mealPlan.ts';

export type MealAlertCfg = { on: boolean; /** minuti prima del pasto */ leadMin: number; times: Partial<Record<Slot, string>> };
export const DEFAULT_MEAL_TIMES: Record<Slot, string> = { colazione: '08:00', spuntino: '10:30', pranzo: '12:30', merenda: '16:30', cena: '19:30' };
export const DEFAULT_MEAL_ALERT: MealAlertCfg = { on: true, leadMin: 60, times: {} };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s: string) => norm(s).split(' ').filter((w) => w.length >= 4);

/** Quanto di un alimento c'e' in frigo (per id oppure per nome simile). */
export function haveGrams(foodId: string, items: PantryItem[]): number {
  const name = FOOD(foodId)?.name ?? foodId;
  const words = key(name);
  let g = 0;
  for (const it of items) {
    if (it.foodId === foodId || (words.length && key(it.name).some((w) => words.includes(w) || words.some((x) => x.startsWith(w) || w.startsWith(x))))) g += stockGrams(it);
  }
  return g;
}

/** Gli alimenti di un pasto che non ci sono (o non bastano) in frigo. */
export function missingForMeal(meal: Pick<PlanMeal, 'items'>, items: PantryItem[]): string[] {
  const out: string[] = [];
  for (const it of meal.items) {
    if (it.foodId === 'acqua' || it.grams < 15) continue; /* un filo d'olio o il sale non fanno saltare la cena */
    if (haveGrams(it.foodId, items) < it.grams * 0.8) out.push(FOOD(it.foodId)?.name ?? it.foodId);
  }
  return out;
}

export type MealAlert = { id: string; at: Date; slot: Slot; mealName: string; time: string; missing: string[] };
const pad = (n: number) => String(n).padStart(2, '0');
/** Gli avvisi da programmare: per i pasti dei prossimi `days` giorni con ingredienti che mancano, `leadMin` minuti prima. Senza scorte segnate non si avvisa (non si sa cosa c'e'). */
export function upcomingMealAlerts(plan: PlanDay[] | null, items: PantryItem[], now: Date, cfg: MealAlertCfg, days = 2): MealAlert[] {
  if (!cfg.on || !plan?.length || !items.length) return [];
  const out: MealAlert[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const wd = (date.getDay() + 6) % 7;
    for (const m of plan[wd] ?? []) {
      const time = cfg.times[m.slot] ?? DEFAULT_MEAL_TIMES[m.slot];
      const [h, mi] = time.split(':').map(Number);
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, mi - cfg.leadMin);
      if (at.getTime() <= now.getTime() + 60000) continue;
      const missing = missingForMeal(m, items);
      if (!missing.length) continue;
      out.push({ id: `lp-meal-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${m.slot}`, at, slot: m.slot, mealName: m.name, time, missing });
    }
  }
  return out;
}
