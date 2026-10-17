import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryOf, spendByCategory, budgetStatus, addToGoal, goalPct, roundUpOf, detectRecurring, splitEqual } from '../src/lib/lpMoney.ts';

const D = (y, m, d) => new Date(y, m, d, 12).getTime();
const mv = (label, amount, ts, ref) => ({ id: label + ts, ts, kind: 'spend', label, amount, ref });
test('categorie e spese del mese contro il mese scorso', () => {
  assert.equal(categoryOf({ label: 'Seminario "X" di Y' }), 'Seminari e servizi');
  assert.equal(categoryOf({ label: 'Contributo a "Idea"' }), 'Idee');
  assert.equal(categoryOf({ label: 'Acquisto AAPL' }), 'Investimenti');
  assert.equal(categoryOf({ label: 'Altro', ref: 'pay:1' }), 'Pagamenti');
  assert.equal(categoryOf({ label: 'LifeFitness LifePass (30 giorni)' }), 'Fitness');
  const now = D(2025, 5, 15);
  const r = spendByCategory([mv('Seminario "A" di B', 40, D(2025, 5, 3)), mv('Seminario "C" di D', 20, D(2025, 4, 10)), mv('Acquisto AAPL', 500, D(2025, 5, 4)), mv('Contributo a "Z"', 10, D(2025, 5, 5))], now);
  assert.equal(r.total, 50);
  assert.equal(r.totalBefore, 20);
  assert.equal(r.rows[0].cat, 'Seminari e servizi');
  assert.equal(r.rows[0].delta, 100);
  assert.equal(r.rows.find((x) => x.cat === 'Idee').delta, null);
});
test('budget, obiettivi, arrotondamento', () => {
  assert.equal(budgetStatus(50, 100).level, 'ok');
  assert.equal(budgetStatus(85, 100).level, 'warn');
  assert.equal(budgetStatus(120, 100).level, 'over');
  assert.equal(budgetStatus(10, 0).level, 'ok');
  const g = { id: '1', name: 'Viaggio', target: 100, saved: 90, createdAt: 0 };
  assert.equal(addToGoal(g, 50).saved, 100);
  assert.equal(addToGoal(g, -200).saved, 0);
  assert.equal(goalPct(addToGoal(g, 50)), 100);
  assert.equal(roundUpOf(12.3), 0.7);
  assert.equal(roundUpOf(12), 0);
});
test('ricorrenze e divisione del conto', () => {
  const r = detectRecurring([mv('LifeFitness LifePass', 9, D(2025, 3, 5)), mv('LifeFitness LifePass (rinnovo)', 9, D(2025, 4, 5)), mv('Una tantum', 5, D(2025, 4, 6))]);
  assert.equal(r.length, 1);
  assert.equal(r[0].amount, 9);
  assert.deepEqual(splitEqual(10, 3), [3.34, 3.33, 3.33]);
  assert.equal(Math.round(splitEqual(10, 3).reduce((a, b) => a + b, 0) * 100), 1000);
  assert.deepEqual(splitEqual(0, 3), []);
});
