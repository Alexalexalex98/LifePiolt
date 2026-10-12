import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../src/lib/ideas.ts';

const D = 86400000;
test('stato della raccolta', () => {
  const base = { raised: 100, target: 500, ts: 0, days: 60 };
  assert.equal(I.ideaState(base, 10 * D), 'raccolta');
  assert.equal(I.ideaState(base, 61 * D), 'scaduta');
  assert.equal(I.ideaState({ ...base, raised: 500 }, 80 * D), 'raggiunta');
  assert.equal(I.ideaState({ raised: 0, target: 500 }, 9999 * D), 'raccolta'); // senza data non scade
});
test('periodo massimo 90 giorni', () => {
  assert.equal(I.clampDays(365), 90);
  assert.equal(I.clampDays(0), 1);
  assert.equal(I.clampDays(undefined), 90);
  assert.equal(I.daysLeft({ raised: 0, target: 1, ts: 0, days: 30 }, 29.5 * D), 1);
  assert.equal(I.daysLeft({ raised: 0, target: 1 }, 0), null);
  assert.equal(I.percentOf({ raised: 700, target: 500 }), 100);
});
