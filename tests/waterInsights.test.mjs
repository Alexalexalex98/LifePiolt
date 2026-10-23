import test from 'node:test';
import assert from 'node:assert/strict';
import { WHAT_IF_HIGH, WHAT_IF_LOW, dayKey, waterLevel, waterPeriod, waterVerdict } from '../src/lib/fitness/waterInsights.ts';
import { analysisText, findings, periodStats } from '../src/lib/fitness/mealInsights.ts';

const NOW = new Date(2026, 9, 23, 10, 0).getTime();
const DAY = 86400000;
const days = (vals) => Object.fromEntries(vals.map((v, i) => [dayKey(NOW - (i + 1) * DAY), v]));

test('livelli rispetto all\'obiettivo', () => {
  assert.equal(waterLevel(1000, 2000), 'poca');
  assert.equal(waterLevel(1600, 2000), 'quasi');
  assert.equal(waterLevel(2000, 2000), 'ok');
  assert.equal(waterLevel(3200, 2000), 'molta');
  assert.equal(waterLevel(4500, 2000), 'troppa');
});
test('periodo: media solo sui giorni con acqua segnata, oggi escluso di mattina', () => {
  const w = { ...days([2000, 0, 1000, 2200]), [dayKey(NOW)]: 500 };
  const p = waterPeriod(w, NOW, 7, 2000);
  assert.equal(p.loggedDays, 3); assert.equal(p.unloggedDays, 4);
  assert.equal(p.avgMl, Math.round(5200 / 3));
  assert.equal(p.daysAtGoal, 2); assert.equal(p.lowDays, 1);
});
test('oggi conta dopo le 20', () => {
  const late = new Date(2026, 9, 23, 21, 0).getTime();
  const p = waterPeriod({ [dayKey(late)]: 1800 }, late, 7, 2000);
  assert.equal(p.loggedDays, 1); assert.equal(p.avgMl, 1800);
});
test('senza acqua segnata niente giudizio', () => {
  const p = waterPeriod({}, NOW, 7, 2000);
  assert.equal(p.level, null); assert.equal(waterVerdict(p), null);
});
test('poca acqua: spiega cosa può succedere e quando chiamare il medico', () => {
  const v = waterVerdict(waterPeriod(days([800, 900, 700]), NOW, 7, 2000));
  assert.equal(v.level, 'carenza'); assert.match(v.tip, /mal di testa/); assert.match(v.tip, /medico/);
});
test('troppa acqua: spiega l\'iponatriemia', () => {
  const v = waterVerdict(waterPeriod(days([5000, 5200, 4800]), NOW, 7, 2000));
  assert.equal(v.level, 'attenzione'); assert.match(v.tip, /sodio/); assert.ok(WHAT_IF_LOW.length && WHAT_IF_HIGH.length);
});
test('l\'analisi di Theia parla di acqua anche senza pasti e segnala l\'eccesso', () => {
  const s = periodStats([], days([5000, 5200]), NOW, 7);
  const f = findings(s, { weightKg: 70 });
  assert.ok(f.some((x) => x.id === 'acqua-troppa'));
  assert.match(analysisText(s, f), /Troppa acqua/);
  const low = findings(periodStats([], days([500, 600]), NOW, 7), { weightKg: 70 });
  assert.ok(low.some((x) => x.id === 'acqua' && /mal di testa/.test(x.tip)));
});
