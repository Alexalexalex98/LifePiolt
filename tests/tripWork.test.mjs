import test from 'node:test';
import assert from 'node:assert/strict';
import { convert, offsetAt, zoneOf, itinerary, tripCost, expenseDrafts, defaultDocs, docsProgress, departureReminders, planClashes, checkSegments, diffLabel, nightsOf, toUtc, fromUtc, segTimes } from '../src/lib/tripWork.ts';

test('fusi orari: Zurigo → New York d\'inverno e d\'estate', () => {
  assert.deepEqual(convert('2026-12-01', '10:00', 'Europe/Zurich', 'America/New_York'), { day: '2026-12-01', time: '04:00', shift: 0, diffMin: -360 });
  assert.equal(convert('2026-07-01', '10:00', 'Europe/Zurich', 'America/New_York').time, '04:00'); // entrambi con ora legale: sempre 6 ore
  assert.equal(convert('2026-03-20', '10:00', 'Europe/Zurich', 'America/New_York').time, '05:00'); // USA già in ora legale, Europa no: 5 ore
});
test('ora legale: date di passaggio', () => {
  const z = zoneOf('Europe/Rome');
  assert.equal(offsetAt(z, Date.UTC(2026, 2, 29, 0, 59)), 60); assert.equal(offsetAt(z, Date.UTC(2026, 2, 29, 1, 0)), 120);
  assert.equal(offsetAt(z, Date.UTC(2026, 9, 25, 0, 59)), 120); assert.equal(offsetAt(z, Date.UTC(2026, 9, 25, 1, 0)), 60);
  const ny = zoneOf('America/New_York');
  assert.equal(offsetAt(ny, Date.UTC(2026, 2, 8, 6, 59)), -300); assert.equal(offsetAt(ny, Date.UTC(2026, 2, 8, 7, 0)), -240);
  assert.equal(offsetAt(zoneOf('Asia/Dubai'), Date.UTC(2026, 6, 1)), 240);
  assert.equal(offsetAt(zoneOf('Australia/Sydney'), Date.UTC(2026, 0, 15)), 660); assert.equal(offsetAt(zoneOf('Australia/Sydney'), Date.UTC(2026, 5, 15)), 600);
});
test('cambio di giorno e andata e ritorno', () => {
  const c = convert('2026-12-01', '23:30', 'America/New_York', 'Europe/Rome'); assert.equal(c.day, '2026-12-02'); assert.equal(c.shift, 1); assert.equal(c.time, '05:30');
  const u = toUtc('2026-06-10', '14:15', 'Asia/Tokyo'); assert.deepEqual(fromUtc(u, 'Asia/Tokyo'), { day: '2026-06-10', time: '14:15' });
  assert.equal(diffLabel(-360), '−6 ore'); assert.equal(diffLabel(330), '+5:30 ore'); assert.equal(diffLabel(0), 'stessa ora');
});
const T = (extra = {}) => ({ id: 't', team_id: 'x', user_id: 'u', title: 'Fiera', dest: 'Zurigo', from_day: '2026-12-01', to_day: '2026-12-03', purpose: '', budget: 500, currency: 'CHF', international: false, docs: [], status: 'draft', decided_by: null, decision_note: '', segments: [
  { id: 'a', kind: 'train', title: 'Treno Milano-Zurigo', day: '2026-12-01', time: '07:10', tz: 'Europe/Rome', endDay: '2026-12-01', endTime: '10:40', endTz: 'Europe/Zurich', cost: 120 },
  { id: 'b', kind: 'hotel', title: 'Hotel Centrale', day: '2026-12-01', time: '15:00', tz: 'Europe/Zurich', cost: 380 },
  { id: 'c', kind: 'meeting', title: 'Riunione Rossi', day: '2026-12-02', time: '09:30', tz: 'Europe/Zurich' }], ...extra });
test('itinerario in ordine e giorni vuoti', () => {
  const it = itinerary(T()); assert.deepEqual(it.map((d) => d.day), ['2026-12-01', '2026-12-02', '2026-12-03']);
  assert.deepEqual(it[0].items.map((s) => s.id), ['a', 'b']); assert.equal(it[2].items.length, 0); assert.equal(nightsOf(T()), 2);
  assert.equal(segTimes(T().segments[0], 'Europe/Zurich').home, null);
  assert.equal(segTimes({ ...T().segments[0], tz: 'America/New_York', time: '23:30' }, 'Europe/Rome').home, '05:30 (+1 g)');
});
test('costi, budget e note spese', () => {
  const c = tripCost(T()); assert.equal(c.total, 500); assert.equal(c.over, false); assert.equal(c.left, 0); assert.equal(c.byKind.hotel, 380);
  assert.equal(tripCost(T({ budget: 400 })).over, true); assert.equal(tripCost(T({ budget: null })).left, null);
  const d = expenseDrafts(T()); assert.deepEqual(d.map((x) => [x.segId, x.category, x.amount]), [['a', 'Trasferta', 120], ['b', 'Hotel', 380]]);
  assert.equal(expenseDrafts(T({ segments: T().segments.map((s) => ({ ...s, expensed: true })) })).length, 0);
});
test('controlli sulle tratte', () => {
  assert.deepEqual(checkSegments(T()), []);
  const bad = T({ segments: [{ id: 'x', kind: 'flight', title: 'Volo', day: '2026-12-09', time: '10:00', tz: 'Europe/Rome', endDay: '2026-12-09', endTime: '08:00', endTz: 'Europe/Rome' }] });
  assert.equal(checkSegments(bad).length, 2);
});
test('documenti', () => {
  const i = defaultDocs(true, true, true); assert.ok(i.some((d) => /Passaporto/.test(d.t)) && i.some((d) => /visto/.test(d.t)) && i.some((d) => /Check-in/.test(d.t)));
  assert.ok(!defaultDocs(false, false, false).some((d) => /Passaporto|visto/.test(d.t)));
  assert.equal(docsProgress([{ t: 'a', done: true }, { t: 'b', done: false }]), 50);
});
test('promemoria di partenza', () => {
  const r = departureReminders(T({ segments: [{ id: 'f', kind: 'flight', title: 'Volo LX', day: '2026-12-01', time: '10:00', tz: 'Europe/Zurich' }] }), 'Europe/Zurich', '2026-11-01');
  assert.ok(r.some((x) => x.time === '07:15' && x.day === '2026-12-01' && /aeroporto/.test(x.title))); // 10:00 − 2h45
  assert.ok(r.some((x) => x.day === '2026-11-30' && x.time === '10:00' && /Check-in/.test(x.title)));
  assert.ok(r.some((x) => x.day === '2026-11-30' && x.time === '20:00' && /valigia/.test(x.title)));
  assert.equal(departureReminders(T(), 'Europe/Rome', '2027-01-01').length, 0);
});
test('impegni in sede durante la trasferta', () => {
  const ev = { '2026-12-02': [{ time: '10:00', title: 'Riunione team', team: 't', wid: 'w1' }, { time: '12:00', title: 'Dentista' }], '2026-12-05': [{ time: '10:00', title: 'Fuori', team: 't' }] };
  assert.deepEqual(planClashes(T(), ev).map((e) => e.title), ['Riunione team']);
  assert.equal(planClashes(T(), ev, new Set(['w1'])).length, 0);
});
