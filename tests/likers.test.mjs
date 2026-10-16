import test from 'node:test';
import assert from 'node:assert/strict';
import { likersFor, MAX_LIKERS_SHOWN } from '../src/lib/likers.ts';

const POOL = ['Anna', 'Bea', 'Carlo', 'Dino', 'Eva', 'Me', 'Autore'];
test('elenco ripetibile, senza me né autore, mai più persone dei mi piace', () => {
  const a = likersFor('post:1', 3, POOL, 'Me', false, 'Autore'), b = likersFor('post:1', 3, POOL, 'Me', false, 'Autore');
  assert.deepEqual(a, b);
  assert.equal(a.names.length, 3);
  assert.ok(!a.names.includes('Me') && !a.names.includes('Autore'));
  assert.equal(a.more, 0);
});
test('se ho messo mi piace compaio per primo e conto come uno', () => {
  const r = likersFor('post:1', 3, POOL, 'Me', true, 'Autore');
  assert.equal(r.names[0], 'Me');
  assert.equal(r.names.length, 3);
});
test('più mi piace delle persone note: «e altre N»; zero mi piace: vuoto; tetto di persone mostrate', () => {
  const r = likersFor('post:2', 500, POOL, 'Me', false, 'Autore');
  assert.equal(r.names.length, 5);
  assert.equal(r.more, 495);
  assert.deepEqual(likersFor('x', 0, POOL, 'Me', false), { names: [], more: 0 });
  const big = Array.from({ length: 100 }, (_, i) => 'P' + i);
  assert.equal(likersFor('k', 90, big, 'Me', false).names.length, MAX_LIKERS_SHOWN);
});
