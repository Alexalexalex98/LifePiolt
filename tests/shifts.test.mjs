import test from 'node:test';
import assert from 'node:assert/strict';
import { upcoming, whenText, countdown, isTime, hoursOf } from '../src/lib/shifts.ts';

const S = (o) => ({ id: 'a', name: 'Mattina', start: '06:00', end: '14:00', weekdays: [], dates: [], ...o });
const now = new Date(2026, 9, 21, 10, 0).getTime(); // mer 21 ott, 10:00

test('turno settimanale: il prossimo e quello in corso', () => {
  const u = upcoming([S({ weekdays: [2, 4] })], now); // mer e ven
  assert.equal(u[0].date, '2026-10-21'); // oggi 06-14 è in corso alle 10
  assert.equal(whenText(u[0], now), 'In corso, finisce alle 14:00');
  assert.equal(u[1].date, '2026-10-23');
  assert.equal(whenText(u[1], now), 'ven 23 ott 06:00');
});
test('turno finito: salta al prossimo giorno previsto', () => {
  const late = new Date(2026, 9, 21, 15, 0).getTime();
  const u = upcoming([S({ weekdays: [2, 4] })], late);
  assert.equal(u[0].date, '2026-10-23');
});
test('date singole e domani', () => {
  const u = upcoming([S({ name: 'Notte', start: '22:00', end: '06:00', dates: ['2026-10-22'] })], now);
  assert.equal(u.length, 1);
  assert.equal(whenText(u[0], now), 'Domani 22:00');
  assert.equal(hoursOf(u[0]), 8);
  assert.ok(u[0].endTs > u[0].startTs);
});
test('turno di notte: alle 02:00 è ancora in corso quello iniziato ieri sera', () => {
  const n = new Date(2026, 9, 22, 2, 0).getTime();
  const u = upcoming([S({ start: '22:00', end: '06:00', dates: ['2026-10-21'] })], n);
  assert.equal(u[0].date, '2026-10-21');
  assert.match(whenText(u[0], n), /In corso/);
});
test('orari non validi si ignorano, tempi in parole', () => {
  assert.deepEqual(upcoming([S({ start: '25:00', weekdays: [0, 1, 2, 3, 4, 5, 6] })], now), []);
  assert.ok(isTime('06:30') && !isTime('6:30'));
  assert.equal(countdown(now + 20 * 60000, now), 'tra 20 min');
  assert.equal(countdown(now + 200 * 60000, now), 'tra 3 h 20 min');
  assert.equal(countdown(now + 3 * 86400000, now), 'tra 3 giorni');
});
