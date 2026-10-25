import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_SLOTS, bodyPrompt } from '../src/lib/fitness/bodyCheck.ts';

test('4 punti di vista, nell\'ordine dichiarato al modello', () => {
  assert.deepEqual(BODY_SLOTS.map((s) => s.id), ['front', 'back', 'left', 'right']);
  assert.match(bodyPrompt(), /davanti, dietro, lato sinistro, lato destro/);
});
test('il testo e\' garbato, senza diagnosi, e usa i dati se ci sono', () => {
  const p = bodyPrompt({ sex: 'f', age: 30, weightKg: 62, heightCm: 168, goal: 'massa' });
  assert.match(p, /donna, 30 anni, 168 cm, 62 kg/); assert.match(p, /obiettivo: massa/);
  assert.match(p, /mai giudicante/); assert.match(p, /Non fare diagnosi/); assert.match(p, /non una visita/); assert.match(p, /decide sempre/);
});

test('promemoria delle foto: dopo 28 giorni; il confronto usa l\'analisi precedente', async () => {
  const { daysToNextPhotos, bodyPrompt, BODY_REPEAT_DAYS } = await import('../src/lib/fitness/bodyCheck.ts');
  const day = 86400000, now = 1000 * day;
  assert.equal(BODY_REPEAT_DAYS, 28); assert.equal(daysToNextPhotos(undefined, now), null);
  assert.equal(daysToNextPhotos(now - 10 * day, now), 18); assert.ok(daysToNextPhotos(now - 30 * day, now) <= 0);
  const p = bodyPrompt({}, { ts: Date.now() - 30 * day, text: 'Spalle da rinforzare.' });
  assert.match(p, /Spalle da rinforzare/); assert.match(p, /cosa è migliorato/); assert.doesNotMatch(bodyPrompt(), /migliorato/);
});
