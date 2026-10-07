import test from 'node:test';
import assert from 'node:assert/strict';
import { busyBlocks, freeSlots, toMin, fmtMin } from '../src/lib/availability.ts';

test('blocchi occupati uniti', () => {
  const b = busyBlocks([{ time: '09:00' }, { time: '09:30' }, { time: '14:00' }]);
  assert.deepEqual(b, [{ from: 540, to: 630 }, { from: 840, to: 900 }]); // 09:00-10:30, 14:00-15:00
});

test('slot liberi nell’orario di lavoro', () => {
  const f = freeSlots([{ time: '10:00' }, { time: '14:00' }], '09:00', '18:00', 30);
  assert.deepEqual(f.map((s) => `${fmtMin(s.from)}-${fmtMin(s.to)}`), ['09:00-10:00', '11:00-14:00', '15:00-18:00']);
});

test('giornata libera, giornata piena e soglia minima', () => {
  assert.deepEqual(freeSlots([], '09:00', '18:00'), [{ from: 540, to: 1080 }]);
  const full = freeSlots(Array.from({ length: 9 }, (_, i) => ({ time: `${9 + i}:00`.padStart(5, '0') })), '09:00', '18:00');
  assert.deepEqual(full, []);
  // lo slot da 30 minuti tra due impegni viene scartato se la soglia è 60
  const f = freeSlots([{ time: '09:00' }, { time: '10:30' }], '09:00', '12:00', 60);
  assert.deepEqual(f, []);
});

test('esclude il passato e impegni fuori orario', () => {
  const f = freeSlots([{ time: '07:00' }, { time: '20:00' }], '09:00', '18:00', 30, 60, toMin('13:20'));
  assert.deepEqual(f, [{ from: 800, to: 1080 }]); // da 13:20 alle 18:00
  assert.equal(fmtMin(800), '13:20');
});

test('orario di lavoro non valido', () => {
  assert.deepEqual(freeSlots([], '18:00', '09:00'), []);
});
