import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientDb, ambientGain, gainFromDb } from '../src/lib/mixLevels.ts';
test('sottofondo sempre ≥15 dB sotto la voce, sonno il più basso', () => {
  for (const k of ['respiro', 'corpo', 'mente', 'sonno', 'cuore', 'lavoro', 'focus']) assert.ok(ambientDb({ kind: k }) <= -15);
  assert.ok(ambientDb({ kind: 'sonno' }) < ambientDb({ kind: 'mente', topic: 'ansia' }));
  assert.ok(ambientDb({ kind: 'mente', topic: 'ansia' }) < ambientDb({ kind: 'focus' }));
});
test('guadagno', () => { assert.ok(Math.abs(gainFromDb(-20) - 0.1) < 1e-9); assert.ok(ambientGain({ kind: 'sonno' }) < 0.05); });
