import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots, moveTargets } from '../src/lib/slots.ts';

test('libero, mio, occupato', () => {
  const s = buildSlots([{ time: '10:00', dur: 60 }], [{ id: 'u', ranges: [[14 * 60, 15 * 60]] }], 60);
  const at = (t) => s.find((x) => x.time === t);
  assert.equal(at('09:00').state, 'free');
  assert.equal(at('10:00').state, 'mine'); assert.deepEqual(at('10:00').mine, [0]);
  assert.equal(at('09:30').state, 'mine');
  assert.equal(at('14:30').state, 'busy'); assert.deepEqual(at('14:30').who, ['u']);
});
test('se un invitato è occupato vince su "mio"', () => {
  const s = buildSlots([{ time: '10:00', dur: 60 }], [{ id: 'u', ranges: [[10 * 60, 11 * 60]] }], 30);
  assert.equal(s.find((x) => x.time === '10:00').state, 'busy');
});
test('impegno tutto il giorno blocca', () => {
  const s = buildSlots([{ time: '00:00', dur: 1440 }], [], 60);
  assert.ok(s.every((x) => x.state === 'busy'));
});
test('dove spostare un impegno', () => {
  const t = moveTargets([{ time: '10:00', dur: 60 }, { time: '12:00', dur: 60 }], 0, [[10 * 60, 11 * 60]], 60);
  assert.ok(!t.includes('10:30') && !t.includes('12:00'));
  assert.ok(t.includes('08:00') && t.includes('11:00'));
});
