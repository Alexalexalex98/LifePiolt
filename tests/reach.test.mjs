import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/lib/reach.ts';

test('numeri di diffusione per azione', () => {
  assert.deepEqual(R.REACH_BOOST, { like: 5, comment: 10, share: 5, daily: 50, idea: 50 });
});
test('ordinamento stabile per diffusione', () => {
  const items = [{ k: 'a' }, { k: 'b' }, { k: 'c' }, { k: 'd' }];
  const out = R.byReach(items, (x) => x.k, { c: 50, b: 5, d: 5 });
  assert.deepEqual(out.map((x) => x.k), ['c', 'b', 'd', 'a']);
  assert.deepEqual(R.byReach(items, (x) => x.k, undefined).map((x) => x.k), ['a', 'b', 'c', 'd']);
});
