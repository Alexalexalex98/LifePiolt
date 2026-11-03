import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, BOOK_MISSING, BOOK_ERRORS, WRITTEN_COUNT } from '../src/lib/recipes/catalog.ts';
import { totalMin, nutritionPer } from '../src/lib/recipes/book.ts';

test('catalogo: nessun ingrediente mancante né errore di formato', () => { assert.deepEqual(BOOK_MISSING, []); assert.deepEqual(BOOK_ERRORS, []); });
test('catalogo: ricette uniche, con passaggi e tempi sensati', () => {
  const ids = new Set(); const names = new Set();
  for (const r of CATALOG) {
    assert.ok(!ids.has(r.id), r.id); ids.add(r.id);
    assert.ok(!names.has(r.name.toLowerCase()), r.name); names.add(r.name.toLowerCase());
    assert.ok(r.steps.length >= 3, r.name); assert.ok(r.items.length >= 2, r.name);
    for (const s of r.steps) { assert.ok(s.text.length > 5, r.name); if (s.timer) assert.ok(s.timer.sec >= 60 && s.timer.sec <= 12 * 3600, `${r.name}: timer`); if (s.oven) assert.ok(s.oven.temp >= 100 && s.oven.temp <= 300, `${r.name}: forno`); }
    assert.ok(totalMin(r) > 0 && totalMin(r) < 24 * 60, r.name);
    if (!r.basic) { assert.ok(r.items.every((i) => i.foodId || i.name), r.name); const n = nutritionPer(r); assert.ok(n.kcal > 20 && n.kcal < 1800, `${r.name}: ${n.kcal} kcal a porzione`); }
  }
  assert.ok(WRITTEN_COUNT >= 60);
});
