import test from 'node:test';
import assert from 'node:assert/strict';
import { healthScore, nutriPoints, parseDetails } from '../src/lib/fitness/foodDetails.ts';

const nutella = { status: 1, product: { product_name: 'Nutella', brands: 'Ferrero,Altro', quantity: '400 g', nutriscore_grade: 'e', nutriscore_score: 26, nova_group: 4, ecoscore_grade: 'd', ecoscore_score: 31,
  ingredients_text: 'Zucchero, olio di palma, nocciole 13%, cacao magro, latte scremato in polvere, lecitine (soia), vanillina', ingredients_analysis_tags: ['en:palm-oil', 'en:vegetarian'], additives_tags: ['en:e322'], allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'], labels_tags: ['en:no-gluten'],
  categories_tags: ['en:spreads', 'en:sweet-snacks'], nutrient_levels: { fat: 'high', 'saturated-fat': 'high', sugars: 'high', salt: 'low' }, nutriments: { 'energy-kcal_100g': 539, fat_100g: 30.9, 'saturated-fat_100g': 10.6, carbohydrates_100g: 57.5, sugars_100g: 56.3, proteins_100g: 6.3, salt_100g: 0.107, calcium_100g: 0.1 } } };
const olio = { status: 1, product: { product_name: 'Lenticchie bio', nutriscore_grade: 'a', nutriscore_score: -6, nova_group: 1, labels_tags: ['en:organic'], ecoscore_grade: 'a', ecoscore_score: 86, ingredients_text: 'Lenticchie', additives_tags: [], nutriments: { 'energy-kcal_100g': 116, fat_100g: 0.4, 'saturated-fat_100g': 0.1, sugars_100g: 1.8, fiber_100g: 7.9, proteins_100g: 9, salt_100g: 0.01 } } };

test('legge i dettagli', () => {
  const d = parseDetails('3017620422003', nutella);
  assert.equal(d.name, 'Nutella'); assert.equal(d.brand, 'Ferrero'); assert.equal(d.palmOil, true); assert.deepEqual(d.allergens, ['Latte', 'Frutta a guscio', 'Soia']);
  assert.equal(d.additives[0].code, 'E322'); assert.equal(d.additives[0].risk, 0); assert.ok(d.labels.includes('Senza glutine')); assert.equal(d.per100.kcal, 539); assert.equal(d.micros[0].name, 'Calcio'); assert.equal(d.micros[0].value, 100);
  assert.equal(parseDetails('1', { status: 0 }), null);
});
test('voto: Nutella basso, lenticchie bio alto', () => {
  const a = healthScore(parseDetails('1', nutella)); const b = healthScore(parseDetails('2', olio));
  assert.ok(a.score <= 39, String(a.score)); assert.ok(a.bad.length >= 3);
  assert.ok(b.score >= 85, String(b.score)); assert.ok(b.good.some((x) => /biologica/.test(x)));
  assert.ok(a.score < b.score);
});
test('Nutri-Score numerico monotono', () => { let prev = 101; for (let s = -15; s <= 40; s++) { const v = nutriPoints(s); assert.ok(v <= prev + 1e-9, `${s}`); prev = v; } });
test('stima senza Nutri-Score e prodotto con additivo vietato', () => {
  const d = parseDetails('3', { status: 1, product: { product_name: 'Caramelle', additives_tags: ['en:e171'], ingredients_text: 'zucchero', nutriments: { 'energy-kcal_100g': 380, sugars_100g: 70 } } });
  const s = healthScore(d); assert.ok(s.score <= 54); assert.ok(s.confidence > 0 && s.confidence <= 100);
});
