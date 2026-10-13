import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotes, notesToText, transcriptText, hasNotes } from '../src/lib/callNotes.ts';

const L = (at, speaker, text) => ({ at: at * 1000, speaker, text });
const lines = [
  L(5, 'Alex', 'Ciao a tutti'),
  L(20, 'Marco T.', 'Abbiamo deciso di spostare la riunione a giovedì alle 10'),
  L(40, 'Giulia M.', 'Io mi occupo di prenotare la sala entro venerdì'),
  L(60, 'Alex', 'Dobbiamo inviare l\'ordine del giorno entro domani'),
  L(75, 'Federica L.', 'Quanto costa la sala per mezza giornata?'),
  L(90, 'Marco T.', 'Il budget è di 1200 CHF e i partecipanti sono 18 persone'),
  L(100, 'Marco T.', 'Il budget è di 1200 CHF e i partecipanti sono 18 persone'),
  L(110, 'Giulia M.', 'ok grazie'),
  L(120, 'Alex', 'Ti mando il file stasera'),
];

test('decisioni, cose da fare con chi e quando, domande, numeri', () => {
  const n = buildNotes(lines);
  assert.equal(n.decisions.length, 1); assert.match(n.decisions[0].text, /spostare la riunione/);
  assert.equal(n.actions.length, 3);
  const sala = n.actions.find((a) => /sala/.test(a.text));
  assert.equal(sala.owner, 'Giulia M.'); assert.equal(sala.due, 'entro venerdi');
  const odg = n.actions.find((a) => /ordine del giorno/.test(a.text));
  assert.equal(odg.owner, 'Tutti'); assert.equal(odg.due, 'entro domani');
  assert.equal(n.actions.find((a) => /file/.test(a.text)).owner, 'Alex');
  assert.equal(n.questions.length, 1); assert.match(n.questions[0].text, /Quanto costa/);
  assert.equal(n.facts.length, 1);   // la riga ripetuta conta una volta
  assert.ok(hasNotes(n));
});
test('cortesie e frasi brevi non finiscono negli appunti', () => {
  const n = buildNotes([L(1, 'A', 'ok grazie'), L(2, 'A', 'ciao'), L(3, 'B', 'sì certo'), L(4, 'B', 'perfetto')]);
  assert.equal(hasNotes(n), false);
});
test('testo degli appunti e trascrizione in ordine di tempo', () => {
  const t = notesToText({ title: 'Riunione', date: 'mer 14 ott', participants: ['Alex', 'Marco T.'], notes: buildNotes(lines) });
  assert.match(t, /Appunti della call «Riunione»/); assert.match(t, /Decisioni/); assert.match(t, /Da fare/); assert.match(t, /Giulia M\. · entro venerdi/);
  assert.match(notesToText({ title: 'X', date: 'd', participants: [], notes: buildNotes([]) }), /Nessun punto importante/);
  const tr = transcriptText([L(70, 'B', 'dopo'), L(5, 'A', 'prima')]).split('\n');
  assert.match(tr[0], /^\[00:05\] A: prima/); assert.match(tr[1], /^\[01:10\] B: dopo/);
});
