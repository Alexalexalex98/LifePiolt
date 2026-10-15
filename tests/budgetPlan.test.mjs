import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestPlan } from '../src/lib/budgetPlan.ts';

test('3500 netti, affitto 1450, cassa malati 480: il piano torna sempre a 3500', () => {
  const p = suggestPlan(3500, 1450, 480);
  assert.equal(p.lines.reduce((a, l) => a + l.amt, 0), 3500);
  assert.equal(p.fixed, 1930); assert.equal(p.free, 1570);
  assert.equal(p.rentHigh, true); assert.ok(Math.abs(p.rentPct - 0.414) < 0.001);
  assert.equal(p.deficit, false);
  assert.ok(p.lines.every((l) => l.amt >= 0));
});
test('se i costi fissi superano lo stipendio il piano lo segnala e non va sotto zero', () => {
  const p = suggestPlan(2000, 1600, 480);
  assert.equal(p.deficit, true); assert.ok(p.lines.every((l) => l.amt >= 0)); assert.equal(p.free, 0);
});
test('affitto sotto il terzo non è segnalato', () => { assert.equal(suggestPlan(6000, 1500, 400).rentHigh, false); });
