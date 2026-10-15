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
