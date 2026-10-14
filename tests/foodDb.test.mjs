import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FOODS, RECIPES, RECIPES_MISSING, matchRecipes } from '../src/lib/fitness/foodDb.ts';
import { FOODS, FOOD, searchFoods, macrosFor } from '../src/lib/fitness/nutrition.ts';

test('database: almeno 2000 prodotti, id e nomi unici', () => {
  assert.ok(DB_FOODS.length >= 2000, String(DB_FOODS.length));
  assert.ok(FOODS.length >= 2000);
  assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length);
});
test('valori sensati per ogni alimento', () => {
  for (const f of DB_FOODS) {
    assert.ok(f.kcal >= 0 && f.kcal <= 900, `${f.name} kcal ${f.kcal}`);
    assert.ok(f.p + f.c + f.f <= 101, `${f.name} macro > 100 g`);
    assert.ok(f.portion > 0 && f.portion <= 1500, `${f.name} porzione`);
    const est = f.p * 4 + f.c * 4 + f.f * 9;
    const alcohol = /Bevande/.test(f.cat) || /vino|birra|grappa|cannella|spirulina/i.test(f.name);
    if (f.kcal > 40 && !alcohol) assert.ok(Math.abs(est - f.kcal) / f.kcal < 0.35, `${f.name}: ${f.kcal} vs ${Math.round(est)}`);
  }
});
test('ricette: tutti gli ingredienti esistono', () => {
  assert.deepEqual(RECIPES_MISSING, []);
  assert.ok(RECIPES.length >= 100);
  for (const r of RECIPES) assert.ok(r.items.length >= 2 && r.method.length > 10, r.name);
});
test('«ho preparato un risotto ai funghi» trova la ricetta', () => {
  assert.match(matchRecipes('ho preparato un risotto ai funghi')[0].recipe.name, /Risotto ai funghi/);
  assert.deepEqual(matchRecipes('ok grazie'), []);
});
test('ricerca ancora compatibile', () => {
  assert.equal(searchFoods('spaghetti')[0].id, 'pasta');
  assert.ok(FOOD('pasta'));
  assert.equal(macrosFor(FOOD('pasta'), 200).kcal, 316);
});
