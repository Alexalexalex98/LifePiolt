import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMealReply, resolveItems } from '../src/lib/fitness/mealPhoto.ts';

test('legge JSON anche in un blocco di codice', () => {
  const r = parseMealReply('```json\n[{"nome":"Riso bianco cotto","grammi":150},{"nome":"Salmone","grammi":"120"},{"nome":"x","grammi":0}]\n```');
  assert.deepEqual(r, [{ name: 'Riso bianco cotto', grams: 150 }, { name: 'Salmone', grams: 120 }]);
});
test('legge un elenco a righe', () => {
  const r = parseMealReply('- Pasta al pomodoro: circa 250 g\n- Insalata mista (80 g)\nBuon appetito');
  assert.equal(r.length, 2); assert.equal(r[0].grams, 250); assert.equal(r[1].name, 'Insalata mista');
});
test('risposte vuote o senza cibo', () => {
  assert.deepEqual(parseMealReply(''), []); assert.deepEqual(parseMealReply('[]'), []); assert.deepEqual(parseMealReply('Non vedo nulla'), []);
});
test('abbina agli alimenti del database', () => {
  const r = resolveItems([{ name: 'Salmone', grams: 120 }, { name: 'qwxzy', grams: 10 }]);
  assert.match(r[0].food.name, /Salmone/); assert.equal(r[1].food, null);
});
