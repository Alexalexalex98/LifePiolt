import test from 'node:test';
import assert from 'node:assert/strict';
import { radar } from '../src/lib/theia/radar.ts';
import { unverifiedNumbers } from '../src/lib/theia/core.ts';

const now = new Date(2026, 9, 21, 20, 0).getTime(); // mer 21 ott 2026, 20:00
const base = { now, events: {}, shifts: [], tasks: [], finance: null, sleep: [], steps: [], water: null, kcal: null, currency: 'CHF' };
const fin = (o) => ({ partial: true, day: 21, daysInMonth: 31, income: 3500, expense: 2400, saved: 0, end: 331, projectionEnd: -200, over: [], topCats: [], ...o });

test('radar: niente dati, niente avvisi', () => { assert.deepEqual(radar(base), []); });

test('radar: il mese finisce in rosso, con i numeri veri', () => {
  const r = radar({ ...base, finance: fin({}) });
  assert.equal(r.length, 1);
  assert.equal(r[0].severity, 'bad');
  assert.match(r[0].why, /2\.400 CHF/);
  assert.match(r[0].why, /-200 CHF/);
  assert.deepEqual(unverifiedNumbers(r[0].why, r[0].facts), []);
});

test('radar: saldo positivo e alto, nessun avviso', () => { assert.deepEqual(radar({ ...base, finance: fin({ projectionEnd: 900 }) }), []); });

test('radar: impegno dentro il turno', () => {
  const shifts = [{ id: 's', name: 'Mattina', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }]; // giovedì
  const r = radar({ ...base, shifts, events: { '2026-10-22': [{ time: '10:00', title: 'Dentista', dur: 60 }] } });
  assert.equal(r[0].kind, 'conflitto');
  assert.match(r[0].why, /domani alle 10:00/);
  assert.deepEqual(unverifiedNumbers(r[0].why, r[0].facts), []);
});

test('radar: turno presto domani e poco sonno', () => {
  const shifts = [{ id: 's', name: 'Alba', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }];
  const r = radar({ ...base, shifts, sleep: [{ day: '2026-10-21', hours: 5.5 }] });
  const p = r.find((x) => x.kind === 'sonno-turno');
  assert.ok(p);
  assert.match(p.why, /entro le 21:00/); // 06:00 - 8h - 1h = 21:00
  assert.deepEqual(unverifiedNumbers(p.why, p.facts), []);
});

test('radar: chi ha dormito bene non riceve l\'avviso del sonno', () => {
  const shifts = [{ id: 's', name: 'Alba', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }];
  assert.equal(radar({ ...base, shifts, sleep: [{ day: '2026-10-21', hours: 7.5 }] }).some((x) => x.kind === 'sonno-turno'), false);
});

test('radar: gli avvisi chiusi non tornano e l\'ordine è per gravità', () => {
  const s = { ...base, finance: fin({}), tasks: [{ id: 't', t: 'Pagare', due: '2026-10-19' }] };
  const all = radar(s);
  assert.deepEqual(all.map((p) => p.kind), ['budget', 'task']);
  assert.deepEqual(radar(s, [all[0].id]).map((p) => p.kind), ['task']);
});
