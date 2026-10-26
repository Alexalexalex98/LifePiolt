import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingDays } from '../src/lib/fitness/plan.ts';

test('trainingDays: i giorni scelti valgono al posto di quelli proposti', () => {
  assert.deepEqual(trainingDays(3), [0, 2, 4]);
  assert.deepEqual(trainingDays(3, [5, 1, 1, 6]), [1, 5, 6]);
  assert.deepEqual(trainingDays(3, []), [0, 2, 4]);
  assert.deepEqual(trainingDays(2, [9, -1]), [1, 4]);
});
