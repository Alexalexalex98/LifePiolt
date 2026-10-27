import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManual, checkManual, collectManual, recentDays, MANUAL_FIELDS } from '../src/lib/healthManual.ts';

test('numeri con virgola o punto', () => { assert.equal(parseManual('7,5'), 7.5); assert.equal(parseManual('7.5'), 7.5); assert.equal(parseManual(''), null); assert.equal(parseManual('abc'), null); });
test('intervalli', () => {
  const sleep = MANUAL_FIELDS.find((f) => f.key === 'sleep');
  assert.equal(checkManual(sleep, '7'), null);
  assert.match(checkManual(sleep, '30'), /tra 0 e 24/);
  assert.match(checkManual(sleep, 'x'), /numero/);
});
test('raccolta: caselle vuote ignorate, errori separati', () => {
  const r = collectManual({ steps: '8000', hr: '', spo2: '120', weight: '72,5' });
  assert.deepEqual(r.entries.map((e) => [e.field.key, e.value]), [['steps', 8000], ['weight', 72.5]]);
  assert.equal(r.errors.length, 1);
});
test('ultimi giorni', () => {
  const d = recentDays(3, new Date(2026, 9, 27));
  assert.deepEqual(d.map((x) => x.key), ['2026-10-27', '2026-10-26', '2026-10-25']);
  assert.deepEqual(d.map((x) => x.label), ['Oggi', 'Ieri', '25/10']);
});
test('tutti i dati di salute sono inseribili', () => {
  const keys = MANUAL_FIELDS.map((f) => f.key);
  for (const k of ['sleep', 'hr', 'steps', 'weight', 'stress', 'hrv', 'mindful', 'energy', 'exercise', 'vo2', 'spo2', 'distance', 'flights', 'resp', 'fat', 'stand', 'hravg', 'basal', 'social']) assert.ok(keys.includes(k), k);
});
