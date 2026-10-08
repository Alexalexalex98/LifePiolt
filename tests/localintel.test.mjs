import test from 'node:test';
import assert from 'node:assert/strict';
import { travelMinutes, travelWarnings } from '../src/lib/places.ts';
import { lateEventSleep, busyDay } from '../src/lib/insightsLocal.ts';
import { skippedWork } from '../src/lib/reschedule.ts';

test('viaggi', () => {
  assert.equal(travelMinutes('Lugano', 'Zurigo'), 150);
  assert.equal(travelMinutes('zurigo', 'lugano'), 150);
  assert.equal(travelMinutes('Lugano', 'Lugano'), 0);
  assert.equal(travelMinutes('Lugano', 'Online'), 0);
  assert.equal(travelMinutes('Lugano', 'Paese Sconosciuto'), 30);
  const w = travelWarnings([{ time: '10:00', title: 'Riunione', dur: 60, place: 'Lugano' }], { time: '11:20', title: 'Cliente', dur: 60, place: 'Zurigo' });
  assert.equal(w.length, 1);
  assert.match(w[0], /20 min ma ne servono circa 150/);
  assert.equal(travelWarnings([], { time: '10:00', title: 'x', place: 'Lugano' }).length, 0);
});

test('riunioni serali e sonno', () => {
  const events = ['2026-09-01', '2026-09-04', '2026-09-08', '2026-09-11'].map((day) => ({ day, time: '19:00', title: 'Cena di lavoro' }));
  const sleep = [];
  for (let i = 0; i < 20; i++) { const d = new Date(2026, 8, 1 + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; sleep.push({ d: k, v: [1, 4, 8, 11].includes(i) ? 6 : 7.5 }); }
  const r = lateEventSleep(events, sleep);
  assert.ok(r && r.diffMin < -60, JSON.stringify(r));
  assert.equal(lateEventSleep(events.slice(0, 2), sleep), null);
  assert.equal(busyDay([{ day: 'a', time: '1', title: '' }], 'a'), null);
});

test('sessioni saltate', () => {
  const now = new Date(2026, 9, 7, 15, 0);
  const evs = [{ day: '2026-10-06', time: '10:30', title: 'Lavoro su: Business plan' }, { day: '2026-10-07', time: '09:00', title: 'Lavoro su: Fatture' }, { day: '2026-10-07', time: '16:00', title: 'Lavoro su: Business plan' }, { day: '2026-10-05', time: '10:00', title: 'Lavoro su: Fatto' }];
  const tasks = [{ id: '1', t: 'Business plan' }, { id: '2', t: 'Fatture', done: true }, { id: '3', t: 'Fatto', done: true }];
  const r = skippedWork(evs, tasks, now);
  assert.deepEqual(r.map((x) => x.task.id), ['1']);
});
