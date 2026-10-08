import test from 'node:test';
import assert from 'node:assert/strict';
import { mapEvent, planSync, describeSync, icalRef } from '../src/lib/calendarMap.ts';

const L = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();
const win = { from: '2026-10-08', to: '2026-12-07' };

test('mapEvent: durata dall\'evento e ref ical', () => {
  const [m] = mapEvent({ id: 'A1', title: 'Dentista', startDate: L(2026, 10, 12, 14, 30), endDate: L(2026, 10, 12, 15, 45) });
  assert.deepEqual(m, { day: '2026-10-12', ev: { time: '14:30', title: 'Dentista', dur: 75, ref: 'ical:A1' } });
});
test('mapEvent: senza fine = 60 minuti, senza titolo = segnaposto, id/data non validi = niente', () => {
  assert.equal(mapEvent({ id: 'B', startDate: L(2026, 10, 12, 9) })[0].ev.dur, 60);
  assert.equal(mapEvent({ id: 'B', title: '  ', startDate: L(2026, 10, 12, 9) })[0].ev.title, 'Evento senza titolo');
  assert.equal(mapEvent({ id: 'B', startDate: 'boh' }).length, 0);
  assert.equal(mapEvent({ id: '', startDate: L(2026, 10, 12, 9) }).length, 0);
});
test('mapEvent: tutto il giorno su piu giorni = un evento per giorno', () => {
  const r = mapEvent({ id: 'V', title: 'Vacanza', startDate: L(2026, 10, 20), endDate: L(2026, 10, 23), allDay: true });
  assert.deepEqual(r.map((x) => x.day), ['2026-10-20', '2026-10-21', '2026-10-22']);
  assert.ok(r.every((x) => x.ev.dur === 1440 && x.ev.time === '00:00'));
});
test('mapEvent: evento a cavallo di mezzanotte', () => {
  const r = mapEvent({ id: 'N', title: 'Notte', startDate: L(2026, 10, 10, 22), endDate: L(2026, 10, 11, 2) });
  assert.equal(r.length, 2);
  assert.equal(r[0].ev.dur, 120); assert.equal(r[1].ev.dur, 120);
});
test('planSync: nuovi eventi, nessun duplicato alla seconda importazione', () => {
  const raws = [{ id: 'A1', title: 'Dentista', startDate: L(2026, 10, 12, 14), endDate: L(2026, 10, 12, 15) }, { id: 'A2', title: 'Cena', startDate: L(2026, 10, 13, 20) }];
  const p1 = planSync(raws, {}, win);
  assert.equal(p1.add.length, 2);
  const existing = {}; p1.add.forEach((a) => { (existing[a.day] ??= []).push(a.ev); });
  const p2 = planSync(raws, existing, win);
  assert.equal(p2.add.length, 0); assert.equal(p2.unchanged, 2);
  assert.match(describeSync(p2), /Già tutto aggiornato/);
});
test('planSync: eventi ricorrenti (stesso id) in giorni diversi non si fondono', () => {
  const raws = [0, 7, 14].map((n) => ({ id: 'R', title: 'Yoga', startDate: L(2026, 10, 14 + n, 18) }));
  assert.equal(planSync(raws, {}, win).add.length, 3);
});
test('planSync: eventi del Plan non importati restano intatti', () => {
  const existing = { '2026-10-12': [{ time: '14:00', title: 'Mio impegno' }] };
  const p = planSync([{ id: 'A1', title: 'Dentista', startDate: L(2026, 10, 12, 14) }], existing, win, { prune: true });
  assert.equal(p.add.length, 1); assert.equal(p.remove.length, 0);
});
test('planSync: modifica sul telefono = aggiornamento; rimozione solo con prune', () => {
  const existing = { '2026-10-12': [{ time: '14:00', title: 'Dentista', dur: 60, ref: icalRef('A1') }, { time: '16:00', title: 'Cancellato', ref: icalRef('Z') }] };
  const raws = [{ id: 'A1', title: 'Dentista', startDate: L(2026, 10, 12, 15), endDate: L(2026, 10, 12, 16) }];
  const soft = planSync(raws, existing, win);
  assert.equal(soft.update.length, 1); assert.equal(soft.update[0].patch.time, '15:00'); assert.equal(soft.remove.length, 0);
  const hard = planSync(raws, existing, win, { prune: true });
  assert.deepEqual(hard.remove, [{ day: '2026-10-12', idx: 1 }]);
});
test('planSync: ignora eventi fuori finestra', () => {
  const p = planSync([{ id: 'F', title: 'Lontano', startDate: L(2027, 3, 1, 10) }, { id: 'P', title: 'Passato', startDate: L(2026, 9, 1, 10) }], {}, win);
  assert.equal(p.add.length, 0);
});
