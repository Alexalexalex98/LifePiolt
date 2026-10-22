/** «Cosa cucino?» (modulo PURO): confronta una ricetta con il frigo, dice cosa manca e quali piatti si possono fare con quello che c'è. */
import { FOOD } from './nutrition.ts';
import { stockGrams, type PantryItem } from './pantry.ts';

export type RecipeLike = { id: string; name: string; method: string; items: { foodId: string; grams: number }[] };
export type IngStatus = { foodId: string; name: string; need: number; have: number; missing: number; /** si usa un alimento simile (stessa famiglia) */ similar?: boolean; /** si dà per scontato che sia in casa */ staple?: boolean };

/** Ingredienti che si danno per scontati (sale, acqua, olio, spezie…): non si contano come mancanti. */
const STAPLE = /^(sale|acqua|pepe|olio|aceto|spezie|brodo|zucchero|peperoncino|origano|basilico|prezzemolo|aglio|alloro|rosmarino|salvia|noce-moscata|farina|lievito|vino|limone)/;
export const isStaple = (foodId: string) => STAPLE.test(foodId);
const family = (id: string) => id.split('-')[0];
const isRaw = (id: string) => /(cruda|crudo|crudi|secch)/.test(id);

/** Quanto ne hai per questo ingrediente: lo stesso alimento, oppure della stessa famiglia (il crudo vale circa 2,5 volte il cotto in peso). */
export function haveOf(foodId: string, items: PantryItem[]): { grams: number; similar: boolean } {
  let exact = 0, near = 0;
  for (const it of items) {
    if (!it.foodId) continue;
    if (it.foodId === foodId) exact += stockGrams(it);
    else if (family(it.foodId) === family(foodId)) {
      const factor = isRaw(it.foodId) && !isRaw(foodId) ? 2.5 : !isRaw(it.foodId) && isRaw(foodId) ? 0.4 : 1;
      near += stockGrams(it) * factor;
    }
  }
  return { grams: Math.round(exact + near), similar: exact === 0 && near > 0 };
}

export function recipeStatus(r: RecipeLike, items: PantryItem[], servings = 1): { ings: IngStatus[]; missing: IngStatus[]; ok: boolean } {
  const ings = r.items.map((i): IngStatus => {
    const need = Math.round(i.grams * servings);
    const staple = isStaple(i.foodId);
    const h = staple ? { grams: need, similar: false } : haveOf(i.foodId, items);
    return { foodId: i.foodId, name: FOOD(i.foodId)?.name ?? i.foodId, need, have: h.grams, missing: Math.max(0, need - h.grams), ...(h.similar ? { similar: true } : {}), ...(staple ? { staple: true } : {}) };
  });
  const missing = ings.filter((x) => x.missing > Math.max(5, x.need * 0.1));
  return { ings, missing, ok: missing.length === 0 };
}

/** I piatti che puoi fare adesso (nessun ingrediente mancante) e quelli a cui manca poco (al massimo `almost` ingredienti). */
export function cookable(recipes: RecipeLike[], items: PantryItem[], servings = 1, almost = 1): { now: { r: RecipeLike; missing: IngStatus[] }[]; soon: { r: RecipeLike; missing: IngStatus[] }[] } {
  if (!items.length) return { now: [], soon: [] };
  const now: { r: RecipeLike; missing: IngStatus[] }[] = [], soon: { r: RecipeLike; missing: IngStatus[] }[] = [];
  for (const r of recipes) {
    const s = recipeStatus(r, items, servings);
    const real = r.items.filter((i) => !isStaple(i.foodId)).length;
    const have = real - s.missing.length;
    if (have <= 0) continue; // non c'è niente di ciò che serve
    if (s.ok) now.push({ r, missing: [] });
    else if (s.missing.length <= almost) soon.push({ r, missing: s.missing });
  }
  return { now, soon };
}
