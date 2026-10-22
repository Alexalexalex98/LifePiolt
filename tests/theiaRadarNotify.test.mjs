import test from 'node:test';
import assert from 'node:assert/strict';
import { planRadarNotifications, nextAt, DIGEST_ID, BED_ID } from '../src/lib/theia/radarNotify.ts';
import { radar } from '../src/lib/theia/radar.ts';

const now = new Date(2026, 9, 21, 20, 0).getTime();
const prefs = { on: true, hour: 9, minute: 0 };
const prop = (o) => ({ id: 'x', kind: 'budget', severity: 'warn', title: 'Titolo', why: 'Perché', facts: [], ...o });

test('spento di base: niente notifiche', () => { assert.deepEqual(planRadarNotifications([prop({})], now, { ...prefs, on: false }), []); });
test('riepilogo: domani all\'ora scelta, solo avvisi importanti', () => {
  const p = planRadarNotifications([prop({}), prop({ id: 'y', severity: 'info', title: 'Minore' })], now, prefs);
  assert.equal(p.length, 1);
  assert.equal(p[0].id, DIGEST_ID);
  assert.equal(new Date(p[0].at).getHours(), 9);
  assert.ok(p[0].at > now);
  assert.equal(p[0].body, 'Titolo');
  assert.equal(p[0].ref, 'reminder:radar');
  assert.deepEqual(planRadarNotifications([prop({ severity: 'info' })], now, prefs), []);
});
test('riepilogo: più avvisi si contano', () => {
  assert.equal(planRadarNotifications([prop({}), prop({ id: 'z' }), prop({ id: 'w' })], now, prefs)[0].body, 'Titolo (e altri 2)');
});
test('mai di notte', () => {
  assert.deepEqual(planRadarNotifications([prop({})], now, { on: true, hour: 23, minute: 0 }), []);
  assert.deepEqual(planRadarNotifications([prop({})], now, { on: true, hour: 5, minute: 30 }), []);
});
test('prossima occorrenza dell\'ora', () => {
  const a = nextAt(new Date(2026, 9, 21, 8, 0).getTime(), 9, 0);
  assert.equal(new Date(a).getDate(), 21);
  const b = nextAt(new Date(2026, 9, 21, 8, 58).getTime(), 9, 0);
  assert.equal(new Date(b).getDate(), 22);
});
test('ricordo per andare a letto prima del turno presto', () => {
  const shifts = [{ id: 's', name: 'Alba', start: '06:00', end: '14:00', weekdays: [3], dates: [], color: '#fff' }];
  const snap = { now, events: {}, shifts, tasks: [], finance: null, sleep: [{ day: '2026-10-21', hours: 5.5 }], steps: [], water: null, kcal: null, currency: 'CHF' };
  const p = planRadarNotifications(radar(snap), now - 2 * 3600000, prefs); // alle 18:00
  const bed = p.find((x) => x.id === BED_ID);
  assert.ok(bed);
  assert.equal(new Date(bed.at).getHours(), 20); // a letto alle 21:00, avviso alle 20:30
  assert.equal(new Date(bed.at).getMinutes(), 30);
  assert.match(bed.body, /entro le 21:00/);
});
