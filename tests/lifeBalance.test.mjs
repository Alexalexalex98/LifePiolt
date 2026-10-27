import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBalance, levelOf } from '../src/lib/lifeBalance.ts';

const def = (id, over = {}) => ({ id, label: id, unit: '', domain: 'salute', better: 'up', dec: 0, color: '#fff', period: 'day', ...over });
const an = (d, v, over = {}) => ({ def: d, source: 'x', pts: [], n: 10, coverage: 1, latest: { d: '2026-10-27', v }, value: v, ageDays: 0, mean: v, median: v, std: 0, min: v, max: v, cv: 0, avg7: v, avgPrev7: v, deltaPct: 0, vsMeanPct: 0, slope: 0, slopePctWeek: 0, r2: 0, t: 0, trend: 'flat', significant: false, status: 'good', goalRate7: null, streak: 0, forecast: null, anomalies: [], ...over });

test('livelli', () => { assert.equal(levelOf(80), 'ok'); assert.equal(levelOf(60), 'attenzione'); assert.equal(levelOf(30), 'carenza'); });
test('senza dati: nessun punteggio', () => {
  const b = buildBalance([]);
  assert.equal(b.score, null); assert.equal(b.cats.length, 0);
});
test('stress alto e sonno corto: sono i punti più deboli, con consigli', () => {
  const list = [
    an(def('sleep', { better: 'range', range: [7, 9], unit: 'h', label: 'Sonno' }), 5.2),
    an(def('stress', { domain: 'mente', better: 'down', target: 45, unit: '/100', label: 'Stress' }), 80),
    an(def('steps', { target: 10000, label: 'Passi' }), 11000),
  ];
  const b = buildBalance(list);
  assert.ok(b.score !== null && b.score < 75);
  assert.deepEqual(b.weakest.map((c) => c.id).sort(), ['sonno', 'stress']);
  assert.ok(b.cats.find((c) => c.id === 'stress').tips.length >= 2);
  assert.match(b.headline, /punto più debole/);
  assert.ok(b.missing.includes('Alimentazione'));
});
test('tutto in linea: equilibrio', () => {
  const b = buildBalance([an(def('steps', { target: 10000 }), 12000), an(def('sleep', { better: 'range', range: [7, 9] }), 8)]);
  assert.equal(b.weakest.length, 0);
  assert.match(b.headline, /equilibrio/);
});
