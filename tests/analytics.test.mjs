import test from 'node:test';
import assert from 'node:assert/strict';
import { ols, analyze, correlations, buildInsights, attainment, makeForecast, addDays, pearson } from '../src/lib/analytics.ts';

// generatore pseudo-casuale deterministico
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const TODAY = '2026-10-07';
const def = (id, over = {}) => ({ id, label: id, unit: '', domain: 'salute', better: 'up', dec: 0, color: '#fff', period: 'day', ...over });
const mk = (id, vals, over = {}) => ({ def: def(id, over), source: 'test', pts: vals.map((v, i) => ({ d: addDays(TODAY, -(vals.length - 1 - i)), v })) });

test('regressione lineare esatta', () => {
  const f = ols([0, 1, 2, 3, 4], [1, 3, 5, 7, 9]);
  assert.ok(Math.abs(f.b - 2) < 1e-9 && Math.abs(f.a - 1) < 1e-9 && Math.abs(f.r2 - 1) < 1e-9);
});

test('pearson: perfetta positiva e negativa', () => {
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-9);
});

test('trend crescente con rumore è significativo e positivo', () => {
  const r = rng(1);
  const vals = Array.from({ length: 21 }, (_, i) => 6000 + i * 150 + (r() - 0.5) * 600);
  const a = analyze(mk('steps', vals, { target: 10000 }), TODAY);
  assert.equal(a.significant, true);
  assert.equal(a.trend, 'up');
  assert.ok(a.slopePctWeek > 5, `slopePctWeek=${a.slopePctWeek}`);
});

test('rumore senza tendenza NON è un trend', () => {
  const r = rng(7);
  const vals = Array.from({ length: 21 }, () => 8000 + (r() - 0.5) * 2000);
  const a = analyze(mk('steps', vals), TODAY);
  assert.equal(a.significant, false);
  assert.equal(a.trend, 'flat');
});

test('previsione su retta esatta segue la pendenza smorzata e ha banda stretta', () => {
  const vals = Array.from({ length: 14 }, (_, i) => 100 + i * 2);
  const s = mk('x', vals);
  const f = makeForecast(s.def, s.pts, 7);
  let cum = 0; for (let h = 1; h <= 7; h++) cum += 2 * 0.92 ** h;
  assert.ok(Math.abs(f.end - (126 + cum)) < 1e-6, `end=${f.end}`);
  assert.ok(f.endHi - f.endLo < 1e-6);
  assert.equal(f.confidence, 'alta');
});

test('anomalia recente viene individuata', () => {
  const r = rng(3);
  const vals = Array.from({ length: 20 }, () => 58 + (r() - 0.5) * 2);
  vals[17] = 75; // 2 giorni fa
  const a = analyze(mk('hr', vals, { better: 'down' }), TODAY);
  assert.equal(a.anomalies.length >= 1, true);
  assert.equal(a.anomalies.some((p) => p.v === 75), true);
});

test('correlazione reale trovata, indipendente ignorata, derivata esclusa', () => {
  const r = rng(11);
  const sleep = Array.from({ length: 28 }, () => 6 + r() * 3);
  const hrv = sleep.map((s) => s * 8 + (r() - 0.5) * 6);
  const noise = Array.from({ length: 28 }, () => r() * 100);
  const stress = hrv.map((h) => 100 - h);
  const list = [mk('sleep', sleep), mk('hrv', hrv), mk('noise', noise), mk('stress', stress, { derivedFrom: ['hrv'] })];
  const c = correlations(list);
  const pairs = c.map((x) => [x.a.id, x.b.id].sort().join('|'));
  assert.ok(pairs.includes('hrv|sleep'), pairs.join());
  assert.ok(!pairs.some((p) => p.includes('noise')), pairs.join());
  assert.ok(!pairs.includes('hrv|stress'), 'derivata non va correlata con la sorgente');
  assert.ok(Math.abs(c[0].r) > 0.8);
});

test('attainment rispetto a obiettivo e a intervallo', () => {
  assert.equal(attainment(def('steps', { target: 10000 }), 5000), 50);
  assert.equal(attainment(def('steps', { target: 10000 }), 12000), 100);
  assert.equal(attainment(def('sleep', { better: 'range', range: [7, 9] }), 8), 100);
  assert.ok(attainment(def('sleep', { better: 'range', range: [7, 9] }), 5) < 100);
});

test('insight: HRV in calo genera un avviso con azione', () => {
  const r = rng(5);
  const vals = Array.from({ length: 21 }, (_, i) => 60 - i * 1.2 + (r() - 0.5) * 3);
  const a = analyze(mk('hrv', vals, { label: 'HRV', unit: 'ms' }), TODAY);
  const ins = buildInsights([a], [], TODAY);
  const t = ins.find((i) => i.id === 'trend-hrv');
  assert.ok(t, 'insight di trend mancante');
  assert.equal(t.severity, 'warn');
  assert.ok(t.action && t.action.length > 5);
});

test('serie troppo corte non producono previsioni né trend', () => {
  const a = analyze(mk('x', [1, 2, 3]), TODAY);
  assert.equal(a.forecast, null);
  assert.equal(a.significant, false);
});

test('p-value: correlazione 0.47 su 28 punti non resiste alla correzione per confronti multipli', async () => {
  const { corrPValue } = await import('../src/lib/analytics.ts');
  const p = corrPValue(0.47, 28);
  assert.ok(p > 0.005 && p < 0.02, `p=${p}`);
  assert.ok(corrPValue(0.97, 28) < 1e-9);
});

import { confirmCorrelation } from '../src/lib/analytics.ts';
{
  const day = (i) => { const d = new Date(2026, 5, 1 + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const def = (id) => ({ id, label: id, unit: '', domain: 'salute', better: 'up', dec: 0, color: '#fff', period: 'day' });
  const ser = (id, f, n = 40) => ({ def: def(id), pts: Array.from({ length: n }, (_, i) => ({ d: day(i), v: f(i) })), source: 'x' });
  const noise = (i) => ((i * 7919) % 13) / 13;
  test('conferma correlazioni: legame stabile = confermata', () => {
    const a = ser('a', (i) => i % 9 + noise(i)), b = ser('b', (i) => 2 * (i % 9) + noise(i * 3) * 0.5);
    assert.equal(confirmCorrelation(a, b, 0).status, 'confermata');
  });
  test('conferma correlazioni: legame solo nella prima meta = non si ripete', () => {
    const a = ser('a', (i) => i % 9 + noise(i));
    const b = ser('b', (i) => (i < 20 ? 2 * (i % 9) : 7 * noise(i * 5 + 1)) + noise(i * 3) * 0.3);
    const c = confirmCorrelation(a, b, 0);
    assert.notEqual(c.status, 'confermata');
    assert.ok(['non si ripete', 'incerta'].includes(c.status));
  });
  test('conferma correlazioni: legame invertito = non si ripete', () => {
    const a = ser('a', (i) => i % 9 + noise(i));
    const b = ser('b', (i) => (i < 20 ? 1 : -1) * 2 * (i % 9) + noise(i * 3) * 0.3);
    assert.equal(confirmCorrelation(a, b, 0).status, 'non si ripete');
  });
  test('conferma correlazioni: pochi dati = incerta', () => {
    assert.equal(confirmCorrelation(ser('a', (i) => i, 8), ser('b', (i) => i, 8), 0).status, 'incerta');
  });
}
