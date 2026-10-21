/** Vitamine e minerali (stima) di un pasto salvato e conversione dei pasti per lo storico (modulo PURO). */
import { microCategory, microFor, sumMicro, type Micro } from './micro.ts';
import type { DayMeal } from './mealInsights.ts';
import { FOOD, macrosFor, type Macros } from './nutrition.ts';

export type StoredMeal = { id: string; ts: number; name: string; foodId?: string; grams: number; macros: Macros; photo?: string; items?: { foodId: string; name: string; grams: number }[] };

/** Somma sugli ingredienti, ognuno assegnato alla sua categoria; senza ingredienti usa il nome del pasto. */
export function microOfMeal(m: Pick<StoredMeal, 'name' | 'grams' | 'foodId' | 'items'>): Micro {
  const items = m.items?.length ? m.items : [{ foodId: m.foodId ?? '', name: m.name, grams: m.grams }];
  return sumMicro(items.map((i) => { const f = FOOD(i.foodId); return microFor({ name: f?.name ?? i.name, tags: f?.tags }, i.grams); }));
}

/** Calorie del pasto che vengono da cibo spazzatura (fritti, dolci, bibite, fast food), ingrediente per ingrediente. */
export function junkKcalOfMeal(m: Pick<StoredMeal, 'name' | 'macros' | 'foodId' | 'items'>): number {
  if (!m.items?.length) return microCategory(m.name) === 'junk' ? m.macros.kcal : 0;
  return Math.round(m.items.reduce((x, i) => { const f = FOOD(i.foodId); const name = f ? `${f.name} ${f.tags ?? ''}` : i.name; return x + (microCategory(name) === 'junk' && f ? macrosFor(f, i.grams).kcal : microCategory(name) === 'junk' ? m.macros.kcal * (i.grams / Math.max(1, m.items!.reduce((a, b) => a + b.grams, 0))) : 0); }, 0));
}

/** I pasti salvati nel formato dello storico, con le vitamine e i minerali stimati e la quota di cibo spazzatura. */
export const withMicro = (meals: StoredMeal[]): DayMeal[] => meals.map((m) => ({ id: m.id, ts: m.ts, name: m.name, grams: m.grams, macros: m.macros, photo: m.photo, micro: microOfMeal(m), junkKcal: junkKcalOfMeal(m) }));
