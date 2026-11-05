import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange, parseIntent } from '../src/lib/workIntent.ts';

const T = '2026-11-05';
test('periodi scritti in italiano', () => {
  assert.deepEqual(parseRange('dal 10 al 17 agosto', T), { from: '2027-08-10', to: '2027-08-17' });
  assert.deepEqual(parseRange('dal 10 al 17 agosto 2026', T), { from: '2026-08-10', to: '2026-08-17' });
  assert.deepEqual(parseRange('dal 24 dicembre al 6 gennaio', T), { from: '2026-12-24', to: '2027-01-06' });
  assert.deepEqual(parseRange('dal 10/08 al 17/08', T), { from: '2027-08-10', to: '2027-08-17' });
  assert.deepEqual(parseRange('dal 20-11-2026 al 24-11-2026', T), { from: '2026-11-20', to: '2026-11-24' });
  assert.deepEqual(parseRange('il 5 dicembre', T), { from: '2026-12-05', to: '2026-12-05' });
  assert.deepEqual(parseRange('domani', T), { from: '2026-11-06', to: '2026-11-06' });
  assert.deepEqual(parseRange('da lunedì a venerdì', T), { from: '2026-11-09', to: '2026-11-13' });
  assert.equal(parseRange('quando vuoi', T), null); assert.equal(parseRange('dal 31 febbraio al 2 marzo', T), null);
});
test('ferie, permessi, malattia', () => {
  assert.deepEqual(parseIntent('Segna le vacanze dal 10 al 17 agosto', T), { type: 'absence', kind: 'ferie', from: '2027-08-10', to: '2027-08-17' });
  assert.deepEqual(parseIntent('Vorrei un permesso domani', T), { type: 'absence', kind: 'permesso', from: '2026-11-06', to: '2026-11-06' });
  assert.equal(parseIntent('Sono malato dal 5/11 al 7/11', T).kind, 'malattia');
  assert.equal(parseIntent('Quante ferie mi restano?', T), null);
});
test('task con scadenza', () => {
  assert.deepEqual(parseIntent('Crea un task: preparare il preventivo entro venerdì', T), { type: 'task', title: 'Preparare il preventivo', due: '2026-11-06' });
  assert.deepEqual(parseIntent('Ricordami di chiamare Bianchi', T), { type: 'task', title: 'Chiamare Bianchi', due: null });
  assert.equal(parseIntent('Di che cosa parla il file?', T), null);
});
