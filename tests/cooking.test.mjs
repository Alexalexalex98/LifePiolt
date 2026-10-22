import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeStatus, cookable, haveOf } from '../src/lib/fitness/cooking.ts';
import { RECIPES } from '../src/lib/fitness/foodDb.ts';

const item = (foodId, qty, unit = 'g') => ({ id: foodId, name: foodId, foodId, qty, unit, min: 10, addedAt: 1 });
const risotto = RECIPES.find((r) => r.id === 'ric-risotto-ai-funghi');
test('ricetta con tutto in frigo: nessun ingrediente mancante (sale e olio si danno per scontati)', () => {
  const items = risotto.items.map((i) => item(i.foodId, i.grams * 3));
  const s = recipeStatus(risotto, items, 2); assert.ok(s.ok, JSON.stringify(s.missing));
});
test('ricetta senza funghi: manca solo quello, con i grammi giusti per due porzioni', () => {
  const items = risotto.items.filter((i) => i.foodId !== 'funghi-champignon').map((i) => item(i.foodId, i.grams * 3));
  const s = recipeStatus(risotto, items, 2);
  assert.equal(s.missing.length, 1); assert.equal(s.missing[0].foodId, 'funghi-champignon'); assert.equal(s.missing[0].missing, 200);
});
test('alimento simile: riso crudo vale per riso bollito (famiglia), con fattore crudo/cotto', () => {
  const h = haveOf('riso-bianco-bollito', [item('riso-bianco-crudo', 100)]); assert.ok(h.similar); assert.equal(h.grams, 250);
});
test('cosa posso cucinare: frigo vuoto -> niente; con gli ingredienti di una ricetta -> compare', () => {
  assert.deepEqual(cookable(RECIPES, []), { now: [], soon: [] });
  const items = risotto.items.map((i) => item(i.foodId, i.grams * 2));
  const r = cookable(RECIPES, items); assert.ok(r.now.some((x) => x.r.id === risotto.id));
});
