import test from 'node:test';
import assert from 'node:assert/strict';
import { record, undoLast, likedInOrder, passedKeys, nextCard, remaining, applyToFeed, isHidden } from '../src/lib/swipeDeck.ts';
import { addSignal } from '../src/lib/relevance.ts';

const C = (key, text, author = 'Anna') => ({ key, text, author });
test('registrare, annullare, ordine di ciò che interessa', () => {
  let s = record([], 'a', 'yes', 10); s = record(s, 'b', 'no', 20); s = record(s, 'c', 'yes', 30);
  assert.deepEqual(likedInOrder(s), ['a', 'c']); assert.deepEqual([...passedKeys(s)], ['b']);
  s = record(s, 'a', 'no', 40); assert.deepEqual(likedInOrder(s), ['c']); assert.equal(s.length, 3);
  const u = undoLast(s); assert.equal(u.undone.key, 'a'); assert.equal(u.swipes.length, 2);
  assert.equal(undoLast([]).undone, null);
});
test('il prossimo: non già scelto, non mio, il più adatto ai temi', () => {
  const cards = [C('1', 'ricetta di pasta al limone'), C('2', 'corsa di 10 km al lago'), C('3', 'allenamento di corsa'), C('m', 'corsa mia', 'Io')];
  const w = addSignal({}, 'corsa', 5);
  assert.equal(nextCard(cards, [], w, 'Io').key, '2');
  assert.equal(nextCard(cards, record([], '2', 'yes', 1), w, 'Io').key, '3');
  assert.equal(remaining(cards, [], w, 'Io'), 3);
  assert.equal(nextCard([C('x', 'a')], record([], 'x', 'no', 1), {}), null);
});
test('scartare insegna: i simili spariscono', () => {
  let w = {}; const cards = [C('1', 'corsa al mattino'), C('2', 'trail di corsa'), C('3', 'ricetta cena')];
  let swipes = [];
  for (const k of ['1']) { swipes = record(swipes, k, 'no', 1); w = addSignal(w, 'corsa al mattino', -3); w = addSignal(w, 'corsa al mattino', -3); }
  assert.equal(isHidden(cards[1], passedKeys(swipes), w), true);
  assert.equal(isHidden(cards[2], passedKeys(swipes), w), false);
  assert.equal(nextCard(cards, swipes, w).key, '3');
});
test('«Per te»: scartati via, graditi in cima nell\'ordine dello swipe', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((k) => ({ k, t: k === 'e' ? 'corsa' : 'altro' }));
  let s = record([], 'd', 'yes', 5); s = record(s, 'b', 'no', 6); s = record(s, 'a', 'yes', 7);
  const out = applyToFeed(items, (x) => x.k, (x) => x.t, s, addSignal({}, 'corsa', -9));
  assert.deepEqual(out.map((x) => x.k), ['d', 'a', 'c']);
});

import { dwellSignal } from '../src/lib/swipeDeck.ts';
test('il tempo di visione conta nell\'algoritmo', () => {
  assert.equal(dwellSignal(500), 0);
  assert.equal(dwellSignal(1400), 0);
  assert.equal(dwellSignal(6000), 1);
  assert.equal(dwellSignal(60000), 2.5);
  assert.equal(dwellSignal(60000, 0.9), 3);
  assert.equal(dwellSignal(3000, 0.5), 0.5);
});
