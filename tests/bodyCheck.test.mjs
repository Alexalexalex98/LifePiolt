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
