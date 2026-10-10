import test from 'node:test';
import assert from 'node:assert/strict';
import { pageIndex, isDoubleTap, captionNeedsMore, raisedPct, dateBadgeParts, chunk } from '../src/components/feed/feedLogic.ts';

test('pageIndex: arrotonda e limita', () => {
  assert.equal(pageIndex(0, 390, 3), 0);
  assert.equal(pageIndex(200, 390, 3), 1);
  assert.equal(pageIndex(9999, 390, 3), 2);
  assert.equal(pageIndex(-50, 390, 3), 0);
  assert.equal(pageIndex(390, 0, 3), 0);
  assert.equal(pageIndex(390, 390, 1), 0);
});
test('doppio tocco', () => {
  assert.equal(isDoubleTap(0, 100), false);
  assert.equal(isDoubleTap(1000, 1200), true);
  assert.equal(isDoubleTap(1000, 1500), false);
});
test('didascalia lunga o su piu righe -> altro', () => {
  assert.equal(captionNeedsMore('breve'), false);
  assert.equal(captionNeedsMore('x'.repeat(111)), true);
  assert.equal(captionNeedsMore('a\nb\nc'), true);
});
test('percentuale di raccolta', () => {
  assert.equal(raisedPct(640, 2000), 32);
  assert.equal(raisedPct(5000, 2000), 100);
  assert.equal(raisedPct(250, 0), 50);
  assert.equal(raisedPct(-5, 100), 0);
});
test('badge data e chunk', () => {
  assert.deepEqual(dateBadgeParts(new Date(2026, 9, 14, 10).getTime()), { day: 14, month: 9 });
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 3), [[1, 2, 3], [4, 5]]);
});
