import test from 'node:test';
import assert from 'node:assert/strict';
import { diaryCsv, diaryHtml, moodSummary } from '../src/lib/wellbeing/diaryExport.ts';
const base = { from: Date.UTC(2026, 9, 1), to: Date.UTC(2026, 10, 30), moods: [{ date: '2026-10-05', day: '2026-10-05', mood: 'Calmo', energy: 4, functioning: 3 }, { date: '2026-10-06', day: '2026-10-06', mood: 'Calmo' }, { date: '2025-01-01', day: '2025-01-01', mood: 'Triste' }], exercises: [{ ts: Date.UTC(2026, 9, 10), title: 'Respiro, lento', answers: 'bene' }], results: [{ ts: Date.UTC(2026, 9, 12), kind: 'who5', score: 15, max: 25, label: 'nella media' }] };
test('CSV: solo il periodo scelto, virgole protette', () => {
  const lines = diaryCsv(base).split('\n');
  assert.equal(lines.length, 5); assert.ok(lines.some((l) => l.includes('"Respiro, lento"'))); assert.ok(!lines.some((l) => l.includes('Triste')));
  assert.ok(!diaryCsv({ ...base, notes: [] }).includes('Nota,'));
});
test('HTML: note solo se incluse, nessun HTML non protetto', () => {
  const h = diaryHtml({ ...base, name: 'A <b>', notes: [{ ts: Date.UTC(2026, 9, 20), kind: 'salute', note: 'mal di testa' }] });
  assert.match(h, /Note scelte dall'utente/); assert.ok(!h.includes('A <b>')); assert.match(h, /15\/25/);
  assert.ok(!diaryHtml(base).includes('Note scelte'));
  assert.deepEqual(moodSummary(base.moods).top[0], ['Calmo', 2]);
});
