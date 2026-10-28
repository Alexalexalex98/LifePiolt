import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShiftsReply, shiftsSummary, shiftsPrompt, SHIFT_TALK } from '../src/lib/shiftsImport.ts';

test('turni raggruppati per nome e orario, con tutte le date; righe non valide scartate', () => {
  const r = parseShiftsReply('```json\n{"turni":[{"d":"2026-11-02","i":"6:00","f":"14:00","n":"Mattina"},{"d":"2026-11-03","i":"06:00","f":"14:00","n":"Mattina"},{"d":"2026-11-04","i":"22:00","f":"06:00","n":"Notte"},{"d":"2026-13-40","i":"06:00","f":"14:00"},{"d":"2026-11-05","i":"99:00","f":"14:00"}]}\n```');
  assert.equal(r.length, 2); assert.deepEqual(r[0].dates, ['2026-11-02', '2026-11-03']); assert.equal(r[0].start, '06:00'); assert.equal(r[1].name, 'Notte');
  assert.match(shiftsSummary(r), /Mattina · 06:00-14:00 · 2 giorni/);
});
test('risposta non valida: nessun turno; prompt con il nome; riconoscimento della richiesta', () => {
  assert.deepEqual(parseShiftsReply('boh'), []);
  assert.match(shiftsPrompt('Alex', 'testo'), /si chiama Alex/);
  assert.equal(SHIFT_TALK.test('Questi sono i miei turni di lavoro'), true); assert.equal(SHIFT_TALK.test('cosa mangio'), false);
});
