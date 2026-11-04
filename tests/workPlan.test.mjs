import test from 'node:test';
import assert from 'node:assert/strict';
import { isWork, matchesFilter, toWireEvent, fromWireEvent, mergeWork } from '../src/lib/workPlan.ts';

test('filtro del Plan: lavoro e personale non si mescolano', () => {
  const w = { team: 'T1' }, p = {}, w2 = { team: 'T2' };
  assert.equal(isWork(w), true); assert.equal(isWork(p), false);
  assert.equal(matchesFilter(w, 'personal'), false); assert.equal(matchesFilter(p, 'work'), false);
  assert.equal(matchesFilter(w2, 'work', 'T1'), false); assert.equal(matchesFilter(w, 'work', 'T1'), true);
  assert.equal(matchesFilter(p, 'all'), true);
});
test('da impegno locale a riga del server e ritorno', () => {
  const w = toWireEvent('2026-11-09', { time: '10:00', title: ' Riunione ', dur: 45, team: 'T1', with: ['me', 'u2'] }, 'me');
  assert.equal(w.title, 'Riunione'); assert.deepEqual(w.attendees, ['u2']); assert.equal(w.team_id, 'T1');
  const back = fromWireEvent({ ...w, created_by: 'u9' }, 'me');
  assert.deepEqual(back.ev.with.sort(), ['u2', 'u9']); assert.equal(back.ev.team, 'T1'); assert.equal(back.ev.color, 'teal');
});
test('unione: aggiunge, aggiorna, toglie i cancellati, non tocca i personali', () => {
  const local = { '2026-11-09': [{ time: '08:00', title: 'Palestra' }, { time: '10:00', title: 'Vecchio', team: 'T1', wid: 'a' }, { time: '11:00', title: 'Sparito', team: 'T1', wid: 'b' }] };
  const rows = [
    { id: 'a', team_id: 'T1', title: 'Nuovo titolo', day: '2026-11-09', time: '10:30', dur: 60, attendees: [], created_by: 'u2' },
    { id: 'c', team_id: 'T1', title: 'Arrivato', day: '2026-11-10', time: '09:00', dur: 30, attendees: ['me'], created_by: 'u2' },
    { id: 'b', team_id: 'T1', title: 'x', day: '2026-11-09', time: '11:00', dur: 30, attendees: [], created_by: 'u2', deleted: true },
  ];
  const out = mergeWork(local, rows, 'T1', 'me');
  assert.deepEqual(out['2026-11-09'].map((e) => e.title), ['Palestra', 'Nuovo titolo']);
  assert.equal(out['2026-11-09'][1].time, '10:30');
  assert.equal(out['2026-11-10'][0].title, 'Arrivato');
});
test('un impegno di un altro team resta com\'è', () => {
  const local = { '2026-11-09': [{ time: '10:00', title: 'Altro', team: 'T2', wid: 'z' }] };
  assert.equal(mergeWork(local, [], 'T1', 'me')['2026-11-09'].length, 1);
});
