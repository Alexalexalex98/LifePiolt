import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, scoreDoc, searchAll, groupHits } from '../src/lib/netSearch.ts';

const docs = [
  { kind: 'persona', id: 'a', title: 'Giulia Moretti', sub: 'Fitness' },
  { kind: 'post', id: 'p1', title: 'Riepilogo della settimana', sub: 'Giulia M.', text: 'quattro allenamenti' },
  { kind: 'servizio', id: 's1', title: 'Psicologa', sub: 'Chiara Bianchi' },
  { kind: 'seminario', id: 'm1', title: 'Cucina sana', text: 'ricette veloci' },
  { kind: 'lavoro', id: 'j1', title: 'Barista', sub: 'Caffè Roma' },
];

test('norm: accenti e maiuscole', () => { assert.equal(norm('  CAFFÈ  Roma '), 'caffe roma'); });
test('scoreDoc: titolo che inizia vale più del testo', () => {
  assert.ok(scoreDoc(docs[0], 'giu') > scoreDoc(docs[1], 'giu'));
  assert.equal(scoreDoc(docs[0], 'xyz'), 0);
});
test('scoreDoc: tutte le parole devono comparire', () => {
  assert.ok(scoreDoc(docs[1], 'riepilogo allenamenti') > 0);
  assert.equal(scoreDoc(docs[1], 'riepilogo cucina'), 0);
});
test('searchAll: senza accento trova con accento, ordina e filtra per tipo', () => {
  assert.equal(searchAll(docs, 'caffe')[0].id, 'j1');
  assert.deepEqual(searchAll(docs, 'giulia').map((h) => h.id), ['a', 'p1']);
  assert.deepEqual(searchAll(docs, 'giulia', { kind: 'post' }).map((h) => h.id), ['p1']);
  assert.deepEqual(searchAll(docs, ''), []);
});
test('searchAll: limite per tipo e raggruppamento con persone per prime', () => {
  const many = [...docs, { kind: 'persona', id: 'b', title: 'Giulio' }, { kind: 'persona', id: 'c', title: 'Giuseppe' }];
  assert.equal(searchAll(many, 'giu', { per: 2 }).filter((h) => h.kind === 'persona').length, 2);
  assert.equal(groupHits(searchAll(docs, 'giulia'))[0].kind, 'persona');
});
