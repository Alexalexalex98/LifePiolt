import test from 'node:test';
import assert from 'node:assert/strict';
import { nextHomeTab, isTabSwipe, carouselEdge } from '../src/lib/feedSwipe.ts';

test('le schede seguono l’ordine Per te, Swipe, Seguiti e si fermano ai bordi', () => {
  assert.equal(nextHomeTab('Per te', 1), 'Swipe');
  assert.equal(nextHomeTab('Swipe', 1), 'Seguiti');
  assert.equal(nextHomeTab('Seguiti', 1), 'Seguiti');
  assert.equal(nextHomeTab('Seguiti', -1), 'Swipe');
  assert.equal(nextHomeTab('Per te', -1), 'Per te');
});
test('solo i gesti orizzontali lunghi o veloci cambiano scheda', () => {
  assert.equal(isTabSwipe(-90, 10), 1);
  assert.equal(isTabSwipe(90, 10), -1);
  assert.equal(isTabSwipe(-20, 5, -0.9), 1);
  assert.equal(isTabSwipe(-20, 5), 0);
  assert.equal(isTabSwipe(-90, 80), 0);
});
test('con più foto cambia scheda solo dall’ultima (o dalla prima verso destra)', () => {
  assert.equal(carouselEdge(0, 3, 1), false);
  assert.equal(carouselEdge(2, 3, 1), true);
  assert.equal(carouselEdge(0, 3, -1), true);
  assert.equal(carouselEdge(1, 3, -1), false);
  assert.equal(carouselEdge(0, 1, 1), false);
});

import { adjacentSection, sectionDirection } from '../src/lib/sectionSwipe.ts';
test('sezioni della barra: vicina a sinistra/destra, ferma ai bordi', () => {
  const it = ['home', 'plan', 'ai'];
  assert.equal(adjacentSection(it, 'plan', 1), 'ai');
  assert.equal(adjacentSection(it, 'plan', -1), 'home');
  assert.equal(adjacentSection(it, 'ai', 1), null);
  assert.equal(adjacentSection(it, 'x', 1), null);
  assert.equal(sectionDirection(-120, 10), 1);
  assert.equal(sectionDirection(120, 10), -1);
  assert.equal(sectionDirection(-30, 5, -0.9), 1);
  assert.equal(sectionDirection(-120, 100), 0);
});

import { discoverAuthors, recapAuthors } from '../src/lib/storyDiscover.ts';
test('recap: Per te include chi non segui ma hai aiutato o ti piace; Seguiti solo chi segui', () => {
  const d = discoverAuthors({ me: 'Alex', following: ['Marco'], dailyHistory: [{ to: 'Sara' }], donorsLog: { Alex: [{ from: 'Elena' }, { from: 'Tu' }] }, likedAuthors: ['Marco', 'Sophie'], swipedYesAuthors: ['Sara', 'Alex'] });
  assert.deepEqual(d.sort(), ['Elena', 'Sara', 'Sophie']);
  assert.deepEqual(recapAuthors(['Marco'], d, 'Seguiti'), ['Marco']);
  assert.deepEqual(recapAuthors(['Marco'], d, 'Per te').sort(), ['Elena', 'Marco', 'Sara', 'Sophie']);
});

import { postLayout } from '../src/components/feed/feedLogic.ts';
test('layout dei post: scritta sulla foto di default, didascalia sotto solo se scelta', () => {
  assert.equal(postLayout({ author: 'A', text: 'x', media: null }), 'text');
  assert.equal(postLayout({ author: 'A', text: 'x', media: 'photo' }), 'overlay');
  assert.equal(postLayout({ author: 'A', text: 'x', media: 'video', captionMode: 'photo' }), 'overlay');
  assert.equal(postLayout({ author: 'A', text: 'x', media: 'photo', captionMode: 'below' }), 'classic');
});

import { rankedPool, pickMixed } from '../src/lib/swipeDeck.ts';
test('swipe: foto e video si alternano', () => {
  const cards = [];
  for (let i = 0; i < 12; i++) cards.push({ key: 'p' + i, text: 'foto ' + i, author: 'X', media: 'photo' });
  for (let i = 0; i < 4; i++) cards.push({ key: 'v' + i, text: 'video ' + i, author: 'X', media: 'video' });
  let swipes = [];
  const seq = [];
  for (let n = 0; n < 8; n++) { const c = pickMixed(rankedPool(cards, swipes, {}, 'me'), swipes.length); seq.push(c.media); swipes = [...swipes, { key: c.key, dir: 'yes', ts: n }]; }
  assert.equal(seq.filter((m) => m === 'video').length, 4);
  assert.ok(seq.every((m, i) => (i % 2 === 0) === (m === 'video')));
});
