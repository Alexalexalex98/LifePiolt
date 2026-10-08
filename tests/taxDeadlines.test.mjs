import test from 'node:test';
import assert from 'node:assert/strict';
import { deadlinesForYear, upcomingDeadlines, taxEventsToAdd, TAX_DISCLAIMER, taxRef } from '../src/lib/taxDeadlines.ts';

test('scadenze tipiche: 31 marzo, 3a al 31 dicembre, cassa malati 30 novembre', () => {
  const l = deadlinesForYear(2027);
  assert.equal(l.find((d) => d.id === 'dichiarazione-2027').day, '2027-03-31');
  assert.equal(l.find((d) => d.id === '3a-2027').day, '2027-12-31');
  assert.equal(l.find((d) => d.id === 'cassa-malati-2027').day, '2027-11-30');
  assert.ok(l.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.title && d.note));
  assert.match(deadlinesForYear(2027).find((d) => d.id === 'dichiarazione-2027').note, /proroga/);
});
test('avviso: date indicative, verifica sul cantone', () => {
  assert.match(TAX_DISCLAIMER, /indicative/); assert.match(TAX_DISCLAIMER, /cantone/);
});
test('prossime scadenze da oggi, ordinate, solo future e entro 12 mesi', () => {
  const l = upcomingDeadlines('2026-10-08');
  assert.ok(l.length >= 5);
  assert.ok(l.every((d) => d.day >= '2026-10-08' && d.day <= '2027-10-08'));
  assert.deepEqual(l.map((d) => d.day), l.map((d) => d.day).slice().sort());
  assert.ok(l.some((d) => d.id === '3a-2026') && l.some((d) => d.id === 'dichiarazione-2027'));
  assert.ok(!l.some((d) => d.id === 'dichiarazione-2026'));
});
test('eventi nel Plan: ref tax:<id>, promemoria, nessun duplicato al secondo inserimento', () => {
  const l = upcomingDeadlines('2026-10-08');
  const first = taxEventsToAdd(l, {});
  assert.equal(first.length, l.length);
  assert.ok(first.every((e) => e.ev.reminder === true && e.ev.ref.startsWith('tax:') && e.ev.title.startsWith('Fisco: ')));
  const existing = {}; first.forEach((e) => { (existing[e.day] ??= []).push(e.ev); });
  assert.equal(taxEventsToAdd(l, existing).length, 0);
  const partial = { [first[0].day]: [{ time: '09:00', title: 'x', ref: taxRef(l[0].id) }] };
  assert.equal(taxEventsToAdd(l, partial).length, l.length - 1);
});
test('due scadenze lo stesso giorno restano entrambe (ref diversi)', () => {
  const l = upcomingDeadlines('2026-10-08').filter((d) => d.day === '2026-12-31');
  assert.equal(l.length, 2);
  assert.equal(taxEventsToAdd(l, {}).length, 2);
});
