import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeLinkCode, decodeLinkCode } from '../src/lib/aiLinkCode.ts';

test('codice di collegamento: andata e ritorno', () => {
  const c = encodeLinkCode(' https://x.workers.dev ', ' segreto-123 ');
  assert.ok(c.startsWith('LPAI1.'));
  assert.deepEqual(decodeLinkCode(`  ${c}\n`), { url: 'https://x.workers.dev', token: 'segreto-123' });
});
test('codice di collegamento: scarta quello che non è un codice', () => {
  assert.equal(decodeLinkCode('ciao'), null);
  assert.equal(decodeLinkCode('LPAI1.@@@'), null);
  assert.equal(decodeLinkCode(`LPAI1.${btoa(JSON.stringify({ u: 'http://x.it', t: 'a' }))}`), null);
  assert.equal(decodeLinkCode(`LPAI1.${btoa(JSON.stringify({ u: 'https://x.it', t: '' }))}`), null);
});
