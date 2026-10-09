import test from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, vacationBands, weekSegments, daySummary, layoutDay, agenda, daysBetween, addDays, weekStart, hourRange, isKey, parseTime } from '../src/lib/calendarLayout.ts';

test('date: giorni tra, +giorni, lunedì della settimana', () => {
  assert.equal(daysBetween('2026-10-30', '2026-11-02'), 3);
  assert.equal(daysBetween('2026-10-30', '2026-11-02', true), 4);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(weekStart('2026-10-09'), '2026-10-05'); // venerdì -> lunedì
  assert.equal(weekStart('2026-10-11'), '2026-10-05'); // domenica -> lunedì
  assert.ok(isKey('2026-02-28')); assert.ok(!isKey('2026-02-30')); assert.ok(!isKey('x'));
  assert.equal(parseTime('--:--'), null); assert.equal(parseTime('09:30'), 570); assert.equal(parseTime('25:00'), null);
});

test('griglia del mese: righe da 7, lunedì primo', () => {
  const g = monthGrid(2026, 9); // ottobre 2026: 1 ott = giovedì
  assert.ok(g.every((r) => r.length === 7));
  assert.equal(g[0][3], '2026-10-01');
  assert.equal(g[0][0], null);
  assert.equal(g.flat().filter(Boolean).length, 31);
});

test('fasce vacanza: con date, selezione, senza duplicati', () => {
  const vac = [{ id: 'v1', dest: 'Lisbona', start: '2026-10-12', end: '2026-10-16' }, { id: 'v2', dest: 'Senza date' }];
  assert.equal(vacationBands(vac, null).length, 1);
  const b = vacationBands(vac, { start: '2026-10-20', end: '2026-10-22' });
  assert.equal(b.length, 2);
  assert.equal(b[1].kind, 'selection'); assert.equal(b[1].name, 'Vacanza');
  assert.equal(vacationBands(vac, { start: '2026-10-12', end: '2026-10-16' }).length, 1);
  assert.equal(vacationBands([], { start: '2026-10-20', end: null })[0].end, '2026-10-20');
});

test('segmenti di fascia su una riga: tagli a inizio/fine settimana e corsie', () => {
  const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
  const bands = [{ id: 'a', name: 'A', start: '2026-10-01', end: '2026-10-07', kind: 'vacation' }, { id: 'b', name: 'B', start: '2026-10-06', end: '2026-10-14', kind: 'vacation' }];
  const s = weekSegments(bands, week);
  assert.equal(s.length, 2);
  assert.deepEqual([s[0].col0, s[0].col1, s[0].capL, s[0].capR, s[0].lane], [0, 2, false, true, 0]);
  assert.deepEqual([s[1].col0, s[1].col1, s[1].capL, s[1].capR, s[1].lane], [1, 6, true, false, 1]);
  assert.equal(weekSegments(bands, [null, null, null, null, null, null, null]).length, 0);
});

test('cella del mese: max 3 etichette + "+N"', () => {
  const ev = (time, title) => ({ time, title });
  const r = daySummary([ev('12:00', 'c'), ev('08:00', 'a'), ev('09:00', 'b'), ev('18:00', 'd'), ev('--:--', 'e')], 3);
  assert.deepEqual(r.shown.map((x) => x.e.title), ['a', 'b', 'c']);
  assert.equal(r.more, 2); assert.equal(r.total, 5);
  assert.equal(daySummary([ev('08:00', 'a')], 3).more, 0);
  assert.equal(daySummary(undefined).total, 0);
});

test('griglia oraria: durata di default 60, corsie per sovrapposti, senza ora = tutto il giorno', () => {
  const { placed, allDay } = layoutDay([
    { time: '09:00', title: 'a', dur: 90 }, { time: '10:00', title: 'b' }, { time: '12:00', title: 'c' }, { time: '--:--', title: 'd' },
  ]);
  assert.equal(allDay.length, 1);
  const by = Object.fromEntries(placed.map((p) => [p.e.title, p]));
  assert.equal(by.a.end - by.a.start, 90); assert.equal(by.b.end - by.b.start, 60);
  assert.deepEqual([by.a.lane, by.b.lane, by.a.lanes, by.b.lanes], [0, 1, 2, 2]);
  assert.deepEqual([by.c.lane, by.c.lanes], [0, 1]);
});

test('agenda: solo giorni con impegni o fasce, in ordine', () => {
  const events = { '2026-10-10': [{ time: '10:00', title: 'x' }], '2026-10-30': [{ time: '10:00', title: 'fuori' }] };
  const bands = [{ id: 'v', name: 'Lisbona', start: '2026-10-12', end: '2026-10-13', kind: 'vacation' }];
  const a = agenda(events, bands, '2026-10-09', 14);
  assert.deepEqual(a.map((d) => d.day), ['2026-10-10', '2026-10-12', '2026-10-13']);
});

test('intervallo ore visibile copre orario di lavoro e impegni', () => {
  const wk = ['2026-10-05'];
  assert.deepEqual(hourRange(wk, {}, { start: '09:00', end: '18:00' }), { from: 8, to: 19 });
  const r = hourRange(wk, { '2026-10-05': [{ time: '06:30', title: 'x' }, { time: '22:00', title: 'y', dur: 120 }] }, { start: '09:00', end: '18:00' });
  assert.deepEqual(r, { from: 6, to: 24 });
});
