import test from 'node:test';
import assert from 'node:assert/strict';
import { sleepHours } from '../src/lib/healthDaily.ts';

const t = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
test('sonno: orologio e telefono sovrapposti non si sommano', () => {
  const r = sleepHours([{ start: t(1, 23), end: t(2, 7) }, { start: t(1, 23, 30), end: t(2, 6, 30) }]);
  assert.equal(r.length, 1); assert.equal(r[0].v, 8);
});
test('sonno: la notte conta nel giorno del risveglio e si scartano durate impossibili', () => {
  const r = sleepHours([{ start: t(3, 22), end: t(4, 6) }, { start: t(5, 12), end: t(5, 12, 20) }]);
  assert.equal(r.length, 1); assert.match(r[0].d, /-04$/);
});
