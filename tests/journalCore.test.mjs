import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, analyzeDay, analyzePeriod, analysisHtml, careNeeded, dayKey, diaryBookHtml, entryText, toneOf, peopleOf, themesOf } from '../src/lib/journalCore.ts';

const E = (day, text) => ({ day, updated: 0, segs: [{ id: day, ts: 0, text, via: 'typed' }] });
test('giorni', () => { assert.equal(addDays('2026-03-01', -1), '2026-02-28'); assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05'); });
test('tono: positivo, negativo, negazione', () => {
  assert.ok(toneOf('Oggi sono felice e sereno, è andata benissimo.').valence > 0.2);
  assert.ok(toneOf('Sono molto stanco e ansioso, una giornata orribile.').valence < -0.2);
  assert.ok(toneOf('Non sono felice.').valence < 0);
  assert.equal(toneOf('Ho comprato il pane.').valence, 0);
});
test('temi e persone', () => {
  assert.ok(themesOf('Il capo mi ha dato una scadenza e non dormo.').includes('lavoro'));
  assert.ok(themesOf('Il capo mi ha dato una scadenza e non dormo.').includes('sonno'));
  const p = peopleOf('Mia madre mi ha abbracciato, sono contento. Con il mio capo ho litigato, sono arrabbiato.');
  assert.equal(p.find((x) => x.who === 'Mamma').valence > 0, true);
  assert.equal(p.find((x) => x.who === 'Colleghi e capo').valence < 0, true);
});
test('allarme', () => { assert.equal(careNeeded('Non voglio più vivere'), true); assert.equal(careNeeded('Che bella giornata'), false); });
test('periodo e analisi senza testo', () => {
  const es = [E('2026-03-01', 'Sono triste e stanco, giornata pesante.'), E('2026-03-02', 'Sono stanco e preoccupato.'), E('2026-03-03', 'Oggi sto meglio, sono sereno e contento.'), E('2026-03-04', 'Giornata bellissima, sono felice, ho riso con gli amici.')];
  const a = analyzePeriod(es, '2026-03-01', '2026-03-07');
  assert.equal(a.written, 4); assert.equal(a.trend, 'su'); assert.ok(a.worst.day <= '2026-03-02');
  const html = analysisHtml(a, 'Anna');
  assert.ok(!html.includes('giornata pesante')); assert.ok(html.includes('Analisi del diario'));
  assert.ok(diaryBookHtml(es, '2026-03-01', '2026-03-07').includes('giornata pesante'));
  assert.equal(entryText(es[0]).startsWith('Sono triste'), true);
  assert.equal(analyzeDay(es[3]).mood === 'molto giù', false);
});
