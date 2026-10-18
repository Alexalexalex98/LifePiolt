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

test('legge anche i valori nutrizionali stimati', () => {
  const r = parseMealReply('[{"nome":"Big Mac","grammi":215,"kcal":560,"proteine":26,"carboidrati":46,"grassi":30},{"nome":"Salmone","grammi":100}]');
  assert.deepEqual(r[0].est, { kcal: 560, p: 26, c: 46, f: 30 });
  assert.equal(r[1].est, undefined);
});
test('senza corrispondenza esatta nel database usa la stima, con valori per 100 g', async () => {
  const { foodFromEstimate } = await import('../src/lib/fitness/mealPhoto.ts');
  const [x] = resolveItems([{ name: 'Big Mac', grams: 200, est: { kcal: 520, p: 26, c: 44, f: 28 } }]);
  assert.equal(x.source, 'ai'); assert.equal(x.food.kcal, 260); assert.match(x.food.id, /^ai-big-mac-/);
  assert.equal(foodFromEstimate({ name: 'x', grams: 0, est: { kcal: 1, p: 0, c: 0, f: 0 } }), null);
});
test('un alimento generico resta sui valori del database', () => {
  const [x] = resolveItems([{ name: 'Salmone', grams: 120, est: { kcal: 999, p: 1, c: 1, f: 1 } }]);
  assert.equal(x.source, 'db'); assert.match(x.food.name, /Salmone/);
});
