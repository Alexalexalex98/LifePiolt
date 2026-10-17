import test from 'node:test';
import assert from 'node:assert/strict';
import { metrics, pillars, dcf, dcfGrid, completeness, typicalPe, FACT_FIELDS } from '../src/lib/markets/fundamentals.ts';

const f = { eps: 5, bvps: 20, fcfps: 6, dps: 2, revenue: 1000, opIncome: 200, netIncome: 150, equity: 800, debt: 300, cash: 400, interest: 20, revGrowth: 8, epsGrowth: 10 };
test('multipli, margini e solidità dai dati', () => {
  const m = metrics(100, f);
  assert.equal(m.pe, 20); assert.equal(m.earningsYield, 5); assert.equal(m.pb, 5); assert.ok(Math.abs(m.pfcf - 16.67) < 0.01);
  assert.equal(m.divYield, 2); assert.equal(m.payout, 40); assert.equal(m.peg, 2);
  assert.equal(m.opMargin, 20); assert.equal(m.netMargin, 15); assert.equal(m.roe, 18.75); assert.equal(m.debtEquity, 0.38); assert.equal(m.netDebt, -100); assert.equal(m.coverage, 10);
  assert.equal(m.graham, 47.43);
  const none = metrics(100, {});
  assert.ok(Object.values(none).every((v) => v === null));
  assert.equal(metrics(100, { eps: -2 }).pe, null);
  assert.equal(metrics(100, { pe: 18 }).pe, 18);
});
test('pagelle: con dati completi tutte presenti, senza dati vuote', () => {
  const p = pillars(100, f, 'Tecnologia');
  assert.equal(p.length, 4);
  assert.ok(p.every((x) => x.score !== null && x.score >= 0 && x.score <= 100 && x.points.length));
  assert.ok(p.find((x) => x.id === 'solidita').score >= 66);
  const e = pillars(100, {});
  assert.ok(e.every((x) => x.score === null && x.verdict === 'dati mancanti'));
  const cheap = pillars(50, { eps: 5 }, 'Tecnologia')[0].score, dear = pillars(300, { eps: 5 }, 'Tecnologia')[0].score;
  assert.ok(cheap > dear);
});
test('valore stimato (DCF) e sensibilità', () => {
  const d = dcf(5, 8, 10, 2.5, 100);
  assert.ok(d.fair > 0 && d.years.length === 5);
  assert.equal(dcf(0, 8, 10, 2.5, 100), null);
  assert.equal(dcf(5, 8, 2, 2.5, 100), null);
  assert.ok(dcf(5, 15, 10, 2.5, 100).fair > dcf(5, 5, 10, 2.5, 100).fair);
  assert.ok(dcf(5, 8, 12, 2.5, 100).fair < dcf(5, 8, 8, 2.5, 100).fair);
  const g = dcfGrid(5, 8, 10, 2.5, 100);
  assert.equal(g.length, 3); assert.equal(g[1][1], d.fair);
});
test('completezza e valori tipici', () => {
  assert.deepEqual(completeness({}), { have: 0, total: FACT_FIELDS.length });
  assert.equal(completeness(f).have, FACT_FIELDS.length);
  assert.deepEqual(typicalPe('Banche'), [8, 14]);
  assert.deepEqual(typicalPe('Sconosciuto'), [12, 25]);
});
