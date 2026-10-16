import test from 'node:test';
import assert from 'node:assert/strict';
import { activeMention, applyMention, mentionedIn, splitMentions, suggestNames } from '../src/lib/mentions.ts';

const NAMES = ['Marco T.', 'Marco', 'Chiara N.', 'Sophie M.', 'Élodie R.'];

test('menzione in corso: solo se la @ è all\'inizio di una parola in fondo al testo', () => {
  assert.deepEqual(activeMention('ciao @mar'), { query: 'mar', start: 5 });
  assert.deepEqual(activeMention('@'), { query: '', start: 0 });
  assert.equal(activeMention('scrivi a mario@mail.com'), null);
  assert.equal(activeMention('niente qui'), null);
});
test('suggerimenti: per inizio nome, poi per parola; senza accenti', () => {
  assert.deepEqual(suggestNames('ma', NAMES), ['Marco T.', 'Marco']);
  assert.deepEqual(suggestNames('n', NAMES), ['Chiara N.']);
  assert.deepEqual(suggestNames('elo', NAMES), ['Élodie R.']);
  assert.equal(suggestNames('', NAMES, 2).length, 2);
});
test('scelta del suggerimento: sostituisce la parte scritta', () => {
  assert.equal(applyMention('ciao @mar', 'Marco T.'), 'ciao @Marco T. ');
  assert.equal(applyMention('@c', 'Chiara N.'), '@Chiara N. ');
  assert.equal(applyMention('senza', 'X'), 'senza');
});
test('riconoscere le menzioni: nome più lungo vince, niente falsi positivi', () => {
  const segs = splitMentions('Grazie @Marco T. e @Sophie M.! scrivimi a x@Marco', NAMES);
  assert.deepEqual(segs.filter((s) => s.mention).map((s) => s.mention), ['Marco T.', 'Sophie M.']);
  assert.equal(segs.map((s) => s.text).join(''), 'Grazie @Marco T. e @Sophie M.! scrivimi a x@Marco');
  assert.deepEqual(mentionedIn('@Marco ciao @Marco', NAMES), ['Marco']);
  assert.deepEqual(splitMentions('nessuna', NAMES), [{ text: 'nessuna' }]);
});
