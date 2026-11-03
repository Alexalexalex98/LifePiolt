import test from 'node:test';
import assert from 'node:assert/strict';
import { trialDay, trialDaysLeft, trialExpired, dueNoteDay, demoCodeOk, TRIAL_DAYS } from '../src/lib/trial.ts';
const D = 86400000, t0 = 1_700_000_000_000;
test('giorno e giorni rimasti', () => {
  assert.equal(trialDay(t0, t0), 1); assert.equal(trialDay(t0, t0 + 6.5 * D), 7); assert.equal(trialDay(t0, t0 + 40 * D), TRIAL_DAYS);
  assert.equal(trialDaysLeft(t0, t0), 14); assert.equal(trialDaysLeft(t0, t0 + 13.9 * D), 1); assert.equal(trialDaysLeft(t0, t0 + 14 * D), 0);
  assert.equal(trialExpired(t0, t0 + 13 * D), false); assert.equal(trialExpired(t0, t0 + 15 * D), true);
});
test('feedback: una sola volta per tappa, anche se salti dei giorni', () => {
  assert.equal(dueNoteDay(1, 0), 1); assert.equal(dueNoteDay(2, 1), null); assert.equal(dueNoteDay(3, 1), 3);
  assert.equal(dueNoteDay(9, 3), 7); assert.equal(dueNoteDay(14, 12), 14); assert.equal(dueNoteDay(14, 14), null);
});
test('codice della modalità demo', () => {
  assert.equal(demoCodeOk('1324'), true); assert.equal(demoCodeOk(' 1324 '), true); assert.equal(demoCodeOk('1234'), false); assert.equal(demoCodeOk(''), false);
});
