import test from 'node:test';
import assert from 'node:assert/strict';
import { lunchAsk, lunchMinutes, DEFAULT_LUNCH } from '../src/lib/fitness/lunch.ts';

const cfg = { on: true, from: '12:30', to: '13:30' };
const at = (h, m) => new Date(2026, 9, 22, h, m);
test('«hai mangiato?» solo dentro la pausa, se attiva', () => {
  assert.equal(lunchAsk({ now: at(12, 45), cfg, answer: undefined }), true);
  assert.equal(lunchAsk({ now: at(12, 29), cfg, answer: undefined }), false);
  assert.equal(lunchAsk({ now: at(13, 30), cfg, answer: undefined }), false);
  assert.equal(lunchAsk({ now: at(12, 45), cfg: DEFAULT_LUNCH, answer: undefined }), false);
  assert.equal(lunchAsk({ now: at(12, 45), cfg: undefined, answer: undefined }), false);
});
test('dopo «sì» non si richiede; dopo «no» si aspetta il rinvio', () => {
  assert.equal(lunchAsk({ now: at(12, 45), cfg, answer: 'si' }), false);
  assert.equal(lunchAsk({ now: at(12, 45), cfg, answer: 'no', snoozeUntil: at(13, 10).getTime() }), false);
  assert.equal(lunchAsk({ now: at(13, 15), cfg, answer: 'no', snoozeUntil: at(13, 10).getTime() }), true);
});
test('durata della pausa', () => { assert.equal(lunchMinutes(cfg), 60); assert.equal(lunchMinutes({ ...cfg, to: '12:30' }), 15); });
