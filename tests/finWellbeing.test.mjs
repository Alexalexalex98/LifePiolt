import test from 'node:test';
import assert from 'node:assert/strict';
import { finWellbeing } from '../src/lib/finWellbeing.ts';

const base = { months: [], budget: null, salary: 0, fixed: 0, bills: { overdue: 0, paidLate: 0, paidOnTime: 0 } };
test('senza dati: punteggio 0 e tutti i fattori mancanti', () => { const r = finWellbeing(base); assert.equal(r.score, 0); assert.equal(r.missing.length, 5); });
test('persona in ordine: ottimo', () => {
  const r = finWellbeing({ months: [1, 2, 3, 4].map(() => ({ income: 4000, expense: 3000 })), budget: { planned: 3000, spent: 2500 }, salary: 4000, fixed: 1800, bills: { overdue: 0, paidLate: 0, paidOnTime: 5 } });
  assert.equal(r.level, 'ottimo'); assert.ok(r.score >= 90);
});
test('spende più di quanto entra e ha bollette scadute: critico', () => {
  const r = finWellbeing({ months: [{ income: 2500, expense: 6300 }, { income: 2500, expense: 3000 }, { income: 2500, expense: 4800 }], budget: { planned: 2000, spent: 2800 }, salary: 2500, fixed: 2100, bills: { overdue: 2, paidLate: 1, paidOnTime: 0 } });
  assert.equal(r.level, 'critico');
});
test('i pesi si ricalcolano sui fattori disponibili', () => {
  const r = finWellbeing({ ...base, months: [{ income: 3000, expense: 2400 }] });
  assert.equal(r.factors.length, 1); assert.equal(r.score, 100);
});
