import test from 'node:test';
import assert from 'node:assert/strict';
import { tagForSource, guessTagFromName, parseTag, GENERIC_TAGS } from '../src/lib/driveTag.ts';

test('dalla sezione al tag', () => {
  assert.equal(tagForSource('Estratto conto'), 'Finanza personale');
  assert.equal(tagForSource('Pasto'), 'Cibo');
  assert.equal(tagForSource('Chat'), 'Chat');
  assert.equal(tagForSource('boh'), 'Caricate da te');
  assert.ok(GENERIC_TAGS.includes('Chat'));
});
test('dal nome del file', () => {
  assert.equal(guessTagFromName('estratto conto ottobre.pdf'), 'Finanza personale');
  assert.equal(guessTagFromName('Bolletta luce.pdf'), 'Bollette');
  assert.equal(guessTagFromName('IMG_1234.jpg'), null);
});
test('dalla risposta dell\'AI', () => {
  assert.equal(parseTag('Bollette'), 'Bollette');
  assert.equal(parseTag('Credo che sia una bolletta, quindi: Bollette.'), 'Bollette');
  assert.equal(parseTag('Cibo'), 'Cibo');
  assert.equal(parseTag('non so'), null);
  assert.equal(parseTag('Chat'), null);
});
