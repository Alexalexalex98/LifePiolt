import test from 'node:test';
import assert from 'node:assert/strict';
import { vacationPlan, parseTarget } from '../src/lib/vacationPlan.ts';

const now = new Date(2026, 9, 22); // 22 ottobre 2026
const base = { now, goal: 2000, target: '2026-12', incomes: [{ name: 'Rossi SA', monthly: 4000 }], fixed: 2200, variable: 800 };
test('2000 per dicembre da ottobre: due mesi, 1000 al mese, margine 1000 -> stretto ma fattibile', () => {
  const p = vacationPlan(base);
  assert.equal(p.months, 2); assert.equal(p.perMonth, 1000); assert.equal(p.margin, 1000);
  assert.equal(p.status, 'stretto'); assert.equal(p.schedule.at(-1).cumulative, 2000);
});
test('più stipendi: il risparmio si divide in proporzione e la somma torna', () => {
  const p = vacationPlan({ ...base, incomes: [{ name: 'A', monthly: 3000 }, { name: 'B', monthly: 1000 }], fixed: 1500, variable: 500 });
  assert.equal(p.income, 4000); assert.equal(p.perMonth, 1000);
  assert.deepEqual(p.perSource.map((x) => x.amount), [750, 250]);
  assert.equal(p.perSource.reduce((s, x) => s + x.amount, 0), p.perMonth);
  assert.ok(p.notes.some((n) => /2 entrate/.test(n)));
});
test('margine insufficiente: non basta, e dice quanto si raggiunge e quanti mesi servono', () => {
  const p = vacationPlan({ ...base, fixed: 2800, variable: 700 });
  assert.equal(p.status, 'non-basta'); assert.equal(p.margin, 500); assert.equal(p.reachable, 1000); assert.equal(p.monthsNeeded, 4);
});
test('già messo da parte, mese passato, senza stipendi', () => {
  assert.equal(vacationPlan({ ...base, saved: 2500 }).status, 'ok');
  assert.equal(vacationPlan({ ...base, target: '2026-09' }).status, 'scaduta');
  assert.equal(vacationPlan({ ...base, incomes: [] }).status, 'senza-dati');
});
test('il mese: nome o AAAA-MM; senza anno è il prossimo', () => {
  assert.equal(parseTarget('dicembre', now), '2026-12');
  assert.equal(parseTarget('settembre', now), '2027-09');
  assert.equal(parseTarget('2027-03', now), '2027-03');
  assert.equal(parseTarget('boh', now), null);
});
