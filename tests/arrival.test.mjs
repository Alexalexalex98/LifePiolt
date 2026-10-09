import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalPlan, pickKinds, adviceText } from '../src/lib/arrival.ts';

test('arrivo in anticipo -> suggerimento', () => {
  const a = arrivalPlan('15:00', 30, 13 * 60);
  assert.equal(a.wait, 90); assert.equal(a.suggest, true); assert.equal(a.leaveBy, '14:20');
});
test('in ritardo', () => {
  const a = arrivalPlan('15:00', 60, 14 * 60 + 30);
  assert.equal(a.late, true); assert.equal(a.suggest, false);
});
test('interessi guidano la proposta', () => {
  assert.deepEqual(pickKinds(['caffe'], 60), ['caffe']);
  assert.ok(pickKinds(['architettura', 'storia'], 60).includes('visita'));
  assert.ok(!pickKinds(['architettura'], 30).includes('visita'));
  assert.equal(pickKinds([], 60)[0], 'passeggiata');
});
test('testo consigli', () => {
  const a = arrivalPlan('15:00', 30, 13 * 60);
  const lines = adviceText('Zurigo', a, ['caffe']);
  assert.ok(lines.some((l) => l.includes('caffè')));
});
