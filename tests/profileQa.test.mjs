import test from 'node:test';
import assert from 'node:assert/strict';
import { qaPairs, qaRef } from '../src/lib/profile/qa.ts';

test('la risposta segue una domanda di un\'altra persona', () => {
  const c = [{ author: 'Bea', text: 'Come si fa?' }, { author: 'Carlo', text: 'Così.' }, { author: 'Bea', text: 'Grazie' }, { author: 'Dino', text: 'Prego' }];
  assert.deepEqual(qaPairs('Anna', 'Nessuna domanda', c), [{ index: 1, asker: 'Bea', answerer: 'Carlo' }]);
});
test('la domanda può essere il post', () => {
  assert.deepEqual(qaPairs('Anna', 'Qualcuno sa dove?', [{ author: 'Bea', text: 'Qui' }, { author: 'Anna', text: 'ok' }]), [{ index: 0, asker: 'Anna', answerer: 'Bea' }]);
});
test('niente autorisposte', () => {
  assert.deepEqual(qaPairs('Anna', 'Dove?', [{ author: 'Anna', text: 'Boh' }]), []);
});
test('ref dello scambio', () => assert.equal(qaRef('standalone:3', 2), 'standalone:3#2'));
