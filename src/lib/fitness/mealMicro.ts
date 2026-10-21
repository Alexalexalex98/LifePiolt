/** Vitamine e minerali (stima) di un pasto salvato e conversione dei pasti per lo storico (modulo PURO). */
import { microFor, sumMicro, type Micro } from './micro.ts';
import type { DayMeal } from './mealInsights.ts';
import { FOOD, type Macros } from './nutrition.ts';

export type StoredMeal = { id: string; ts: number; name: string; foodId?: string; grams: number; macros: Macros; photo?: string; items?: { foodId: string; name: string; grams: number }[] };

/** Somma sugli ingredienti, ognuno assegnato alla sua categoria; senza ingredienti usa il nome del pasto. */
export function microOfMeal(m: Pick<StoredMeal, 'name' | 'grams' | 'foodId' | 'items'>): Micro {
  const items = m.items?.length ? m.items : [{ foodId: m.foodId ?? '', name: m.name, grams: m.grams }];
  return sumMicro(items.map((i) => { const f = FOOD(i.foodId); return microFor({ name: f?.name ?? i.name, tags: f?.tags }, i.grams); }));
}

/** I pasti salvati nel formato dello storico, con le vitamine e i minerali stimati. */
export const withMicro = (meals: StoredMeal[]): DayMeal[] => meals.map((m) => ({ id: m.id, ts: m.ts, name: m.name, grams: m.grams, macros: m.macros, photo: m.photo, micro: microOfMeal(m) }));
