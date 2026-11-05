import test from 'node:test';
import assert from 'node:assert/strict';
import { similarity, findBest, findPerson } from '../src/lib/agent/match.ts';

test('somiglianza di nomi', () => {
  assert.equal(similarity('Giulia Verdi', 'giulia verdi'), 1); assert.ok(similarity('Giulia', 'Giulia Verdi') > 0.6); assert.ok(similarity('sito', 'Sito nuovo') > 0.6);
  assert.equal(similarity('xyz', 'Giulia Verdi'), 0); assert.ok(similarity('Bianchi srl', 'Bianchi SA') >= 0.5); assert.ok(similarity('preventivo bianchi', 'Preventivo · Bianchi · Sito') > 0.6);
});
test('trova il migliore e segnala i dubbi', () => {
  const l = [{ n: 'Giulia Verdi' }, { n: 'Marco Rossi' }, { n: 'Marco Bianchi' }];
  assert.equal(findBest('giulia', l, (x) => x.n).best.item.n, 'Giulia Verdi');
  assert.equal(findBest('marco', l, (x) => x.n).ambiguous.length, 2); assert.equal(findBest('marco rossi', l, (x) => x.n).best.item.n, 'Marco Rossi');
  assert.deepEqual(findBest('nessuno', l, (x) => x.n), {}); assert.deepEqual(findBest('', l, (x) => x.n), {});
});
test('persone e «io»', () => {
  const p = [{ id: 'a', name: 'Alex Rossi' }, { id: 'b', name: 'Giulia Verdi' }];
  assert.equal(findPerson('io', p, 'a').me, true); assert.equal(findPerson('Alex', p, 'a').me, true); assert.equal(findPerson('giulia', p, 'a').best.item.id, 'b'); assert.equal(findPerson('giulia', p, 'a').me, undefined);
});
