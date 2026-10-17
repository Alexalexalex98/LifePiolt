import test from 'node:test';
import assert from 'node:assert/strict';
import { smaSeries, emaSeries, rsi, macd, bollinger, periodReturn, annualVol, maxDrawdown, valueAtRisk, correlation, beta, range52, levels, trend, riskLevel, projectRange, positionSize, rebase, signals, stdev } from '../src/lib/markets/analysis.ts';

const up = Array.from({ length: 300 }, (_, i) => 100 + i * 0.5);
const down = up.slice().reverse();
const wave = Array.from({ length: 300 }, (_, i) => 100 + 10 * Math.sin(i / 6));

test('medie, RSI, MACD, Bollinger', () => {
  assert.deepEqual(smaSeries([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  assert.equal(emaSeries([5, 5, 5], 3).every((x) => x === 5), true);
  assert.equal(rsi(up), 100);
  assert.ok(rsi(down) < 5);
  assert.equal(rsi([1, 2, 3]), null);
  assert.ok(macd(up).hist > -0.001 && macd(up).macd > 0);
  assert.ok(macd(down).macd < 0);
  assert.equal(macd([1, 2]), null);
  const b = bollinger(wave);
  assert.ok(b.upper > b.mid && b.mid > b.lower && b.pctB >= -0.5 && b.pctB <= 1.5);
});
test('rendimenti, rischio, drawdown, VaR', () => {
  assert.ok(Math.abs(periodReturn([100, 110], 1) - 0.1) < 1e-9);
  assert.equal(periodReturn([100], 5), null);
  assert.equal(maxDrawdown([100, 120, 60, 90]), -0.5);
  assert.equal(maxDrawdown(up), 0);
  assert.ok(annualVol(wave) > 0 && annualVol(up) < annualVol(wave));
  assert.ok(valueAtRisk(wave) < 0);
  assert.equal(riskLevel(0.1), 'basso'); assert.equal(riskLevel(0.5), 'molto alto');
  assert.ok(stdev([1, 1, 1]) === 0);
});
test('beta e correlazione', () => {
  const bench = wave, double = wave.map((x) => 100 + (x - 100) * 2);
  assert.ok(correlation(double, bench) > 0.99);
  assert.ok(beta(double, bench) > 1.5 && beta(double, bench) < 2.5);
  assert.equal(correlation([1, 2], [1, 2]), null);
});
test('fascia annua, livelli, andamento', () => {
  const r = range52(wave);
  assert.ok(r.low < r.high && r.pos >= 0 && r.pos <= 1);
  const l = levels(wave);
  assert.ok(l.supports.every((s) => s < wave[wave.length - 1]) && l.resistances.every((s) => s > wave[wave.length - 1]));
  assert.equal(trend(up).trend, 'rialzista');
  assert.equal(trend(down).trend, 'ribassista');
});
test('scenari, dimensionamento, confronto, osservazioni', () => {
  const p = projectRange(100, 0.3, 252);
  assert.ok(p.low < p.mid && p.mid < p.high && p.low > 0);
  const s = positionSize({ capital: 1000, riskPct: 2, entry: 100, stop: 90 });
  assert.equal(s.units, 2); assert.equal(s.maxLoss, 20); assert.equal(s.capped, false);
  const c = positionSize({ capital: 100, riskPct: 50, entry: 100, stop: 99 });
  assert.equal(c.capped, true); assert.equal(c.cost, 100);
  assert.ok(positionSize({ capital: 100, riskPct: 1, entry: 100, stop: 120 }).error);
  assert.equal(rebase([50, 100], 2)[1], 200);
  const sg = signals(up, wave);
  assert.ok(sg.length >= 6 && sg.some((x) => x.id === 'trend' && x.tone === 'pos'));
  assert.deepEqual(signals([1, 2, 3]), []);
});
