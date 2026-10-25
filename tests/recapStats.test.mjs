import test from 'node:test';
import assert from 'node:assert/strict';
import { recap } from '../src/lib/fitness/recapStats.ts';

const now = new Date(2026, 9, 25, 22).getTime();
const at = (daysAgo, h, kcal, name = 'Pasta') => ({ id: `${daysAgo}-${h}`, ts: new Date(2026, 9, 25 - daysAgo, h).getTime(), name, grams: 300, macros: { kcal, p: 20, c: 50, f: 10, sug: 5, fib: 3 } });

test('recap: totali, media, serie e confronto', () => {
  const meals = [at(0, 8, 400), at(0, 13, 700), at(1, 13, 800, 'Riso'), at(2, 20, 600), at(9, 13, 1000)];
  const r = recap(meals, now, 7, { targetKcal: 1500 });
  assert.equal(r.logged, 3);
  assert.equal(r.meals, 4);
  assert.equal(r.avgKcal, 833);
  assert.equal(r.series.length, 7);
  assert.equal(r.top.kcal, 1100);
  assert.equal(r.streak, 3);
  assert.ok(Math.abs(r.split.p + r.split.c + r.split.f - 1) < 1e-9);
  assert.equal(r.delta, -17);
});

test('recap: periodo vuoto', () => {
  const r = recap([], now, 30);
  assert.equal(r.logged, 0);
  assert.equal(r.avgKcal, 0);
});
