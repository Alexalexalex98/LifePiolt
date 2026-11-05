import test from 'node:test';
import assert from 'node:assert/strict';
import { dayStats, workLoad, breakPlan, outsideHours, EXERCISES, exerciseOfDay, moodVsLoad, moodAverage, lastDays } from '../src/lib/workWell.ts';

const S = { '1': [['09:00', '12:30'], ['14:00', '18:00']], '2': [['09:00', '12:30'], ['14:00', '18:00']] };
const MON = '2026-11-02'; // lunedì

test('orario: dentro e fuori', () => {
  assert.equal(outsideHours(S, MON, 10 * 60), false);
  assert.equal(outsideHours(S, MON, 13 * 60), true);
  assert.equal(outsideHours(S, MON, 19 * 60), true);
  assert.equal(outsideHours(S, '2026-11-01', 10 * 60), true); // domenica libera
});
test('ore fuori orario e riunioni di fila', () => {
  const ev = [{ time: '09:00', dur: 60, team: 't', title: 'a' }, { time: '10:00', dur: 60, team: 't', title: 'b' }, { time: '11:00', dur: 90, team: 't', title: 'c' }, { time: '18:00', dur: 60, team: 't', title: 'late' }, { time: '08:00', dur: 30, title: 'privato' }];
  const d = dayStats(ev, S, MON);
  assert.equal(d.extraMin, 60); // solo 18:00-19:00 (il privato non conta)
  assert.equal(d.longestStretch, 210); assert.equal(d.noBreak, true);
  assert.equal(d.meetingMin, 270 + 0);
});
test('carico: segnali con consiglio', () => {
  const byDay = { [MON]: [{ time: '09:00', dur: 60, team: 't', title: 'a' }, { time: '10:00', dur: 60, team: 't', title: 'b' }, { time: '11:00', dur: 90, team: 't', title: 'c' }, { time: '18:00', dur: 120, team: 't', title: 'late' }] };
  const tasks = [1, 2, 3, 4].map(() => ({ team: 't', due: '2026-10-30', done: false }));
  const l = workLoad(byDay, S, tasks, MON, 7);
  assert.ok(l.signals.some((x) => x.id === 'stretch') && l.signals.some((x) => x.id === 'overdue') && l.signals.some((x) => x.id === 'extra-today'));
  assert.ok(l.signals.every((x) => x.tip.length > 10));
  assert.equal(l.level, 'alto');
  assert.equal(workLoad({}, S, [], MON).level, 'ok');
});
test('pause solo dove non ci sono impegni', () => {
  const free = breakPlan([], S, MON); assert.ok(free.length >= 4);
  assert.ok(free.every((b) => b.time >= '09:00' && b.time < '18:00'));
  const busy = breakPlan([{ time: '09:00', dur: 600, title: 'x' }], S, MON); assert.equal(busy.length, 0);
  assert.deepEqual(breakPlan([], S, '2026-11-01'), []);
});
test('esercizi', () => {
  assert.ok(EXERCISES.length >= 8 && EXERCISES.every((e) => e.steps.length >= 3 && e.seconds > 0));
  assert.equal(exerciseOfDay('2026-11-02').id, exerciseOfDay('2026-11-02').id);
});
test('umore: niente senza dati, confronto con carico', () => {
  assert.equal(moodVsLoad([], () => 0).hint, null);
  const days = lastDays('2026-11-10', 8);
  const moods = days.map((d, i) => ({ day: d, v: i % 2 ? 2 : 5 }));
  const r = moodVsLoad(moods, (d) => (days.indexOf(d) % 2 ? 400 : 100));
  assert.match(r.hint, /più stanco/);
  assert.equal(moodAverage(moods, days), 3.5);
  assert.equal(moodAverage([], days), null);
});
