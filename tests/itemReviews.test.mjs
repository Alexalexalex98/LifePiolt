import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/lib/profile/itemReviews.ts';

test('recensioni dimostrative: deterministiche e senza doppioni', () => {
  const a = R.demoItemReviews('seminar:2', 1e12), b = R.demoItemReviews('seminar:2', 1e12);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((x) => x.from)).size, a.length);
  assert.ok(a.every((x) => x.stars >= 1 && x.stars <= 5));
});
test('unione: una per persona, le vere vincono, ordine per data', () => {
  const real = [{ from: 'Io', stars: 5, text: 'ok', ts: 3000 }, { from: 'Giulia M.', stars: 2, ts: 1000 }];
  const demo = [{ from: 'Giulia M.', stars: 5, ts: 9000, demo: true }, { from: 'Luca B.', stars: 4, ts: 2000, demo: true }];
  const m = R.mergeReviews(real, demo);
  assert.deepEqual(m.map((x) => x.from), ['Io', 'Luca B.', 'Giulia M.']);
  assert.equal(m.find((x) => x.from === 'Giulia M.').stars, 2);
  assert.equal(R.averageOf([]), null);
  assert.equal(R.averageOf([{ stars: 5 }, { stars: 4 }]), 4.5);
});
