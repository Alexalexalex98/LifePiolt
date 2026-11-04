import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHEDULE, freeSlots, fitsInHours, nextFree, commonFree, planTasks, subtract, mergeRanges, daySpans } from '../src/lib/workHours.ts';

const MON = '2026-11-02', SAT = '2026-11-07';
test('fasce del giorno e weekend libero', () => {
  assert.deepEqual(daySpans(DEFAULT_SCHEDULE, MON), [[540, 750], [840, 1080]]);
  assert.deepEqual(daySpans(DEFAULT_SCHEDULE, SAT), []);
});
test('fasce libere tolgono gli impegni', () => {
  assert.deepEqual(freeSlots(DEFAULT_SCHEDULE, MON, [[600, 660]], 30), [[540, 600], [660, 750], [840, 1080]]);
});
test('un impegno fuori orario non entra', () => {
  assert.equal(fitsInHours(DEFAULT_SCHEDULE, MON, '09:00', 60), true);
  assert.equal(fitsInHours(DEFAULT_SCHEDULE, MON, '12:00', 60), false);
  assert.equal(fitsInHours(DEFAULT_SCHEDULE, SAT, '10:00', 30), false);
});
test('primo posto libero salta pausa e weekend', () => {
  assert.deepEqual(nextFree(DEFAULT_SCHEDULE, MON, 12 * 60 + 40, 60, () => []), { day: MON, time: '14:00' });
  assert.deepEqual(nextFree(DEFAULT_SCHEDULE, SAT, 0, 30, () => []), { day: '2026-11-09', time: '09:00' });
  assert.equal(nextFree({}, MON, 0, 30, () => []), null);
});
test('fasce in comune tra due persone', () => {
  const a = { schedule: DEFAULT_SCHEDULE, busy: [[540, 600]] };
  const b = { schedule: { '1': [['10:00', '16:00']] }, busy: [] };
  assert.deepEqual(commonFree([a, b], MON, 60), [[600, 750], [840, 960]]);
});
test('pianifica i task: urgenti prima, senza sovrapporsi', () => {
  const r = planTasks(DEFAULT_SCHEDULE, [{ id: 'a', dur: 120 }, { id: 'b', dur: 60, urgent: true }], MON, 540, () => []);
  assert.deepEqual(r.map((x) => [x.id, x.time]), [['b', '09:00'], ['a', '10:00']]);
});
test('task con scadenza che non entra viene scartato', () => {
  const r = planTasks(DEFAULT_SCHEDULE, [{ id: 'a', dur: 60, due: MON }], MON, 17 * 60 + 30, () => []);
  assert.deepEqual(r, []);
});
test('unione e sottrazione', () => {
  assert.deepEqual(mergeRanges([[0, 10], [10, 20], [30, 40]]), [[0, 20], [30, 40]]);
  assert.deepEqual(subtract([[0, 100]], [[20, 30], [90, 120]]), [[0, 20], [30, 90]]);
});
import { parseSpans, formatSpans } from '../src/lib/workHours.ts';
test('lettura delle fasce scritte a mano', () => {
  assert.deepEqual(parseSpans('9-12:30, 14-18'), [['09:00', '12:30'], ['14:00', '18:00']]);
  assert.deepEqual(parseSpans('libero'), []);
  assert.equal(parseSpans('12-9'), null);
  assert.equal(parseSpans('9-13, 12-18'), null);
  assert.equal(parseSpans('pippo'), null);
  assert.equal(formatSpans([['09:00', '12:30']]), '09:00-12:30');
});
