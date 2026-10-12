import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/lib/focusPlan.ts';

test('fino a 25 minuti: un solo blocco, nessuna pausa', () => {
  assert.deepEqual(F.focusPlan(20), [{ kind: 'work', min: 20 }]);
  assert.deepEqual(F.focusPlan(25), [{ kind: 'work', min: 25 }]);
});
test('oltre 25 minuti: pausa da 5 ogni 25, ultimo blocco senza pausa', () => {
  assert.deepEqual(F.focusPlan(60).map((s) => `${s.kind[0]}${s.min}`), ['w25', 'b5', 'w25', 'b5', 'w10']);
});
test('dopo 125 minuti di lavoro la pausa è di 15', () => {
  const p = F.focusPlan(150);
  assert.deepEqual(p.map((s) => `${s.kind[0]}${s.min}`), ['w25', 'b5', 'w25', 'b5', 'w25', 'b5', 'w25', 'b5', 'w25', 'b15', 'w25']);
  assert.equal(F.focusPlan(125).at(-1).kind, 'work'); // 125 esatti: finisce col lavoro, niente pausa lunga finale
});
test('limiti del totale', () => {
  assert.equal(F.clampTotal(1), 5);
  assert.equal(F.clampTotal(9999), 480);
  assert.equal(F.clampTotal(NaN), 25);
});
test('posizione nel tempo: lavoro, pausa, fine', () => {
  const p = F.focusPlan(60);
  const a = F.focusAt(p, 10 * 60000);
  assert.equal(a.kind, 'work'); assert.equal(a.remainingMs, 15 * 60000); assert.equal(a.workMinDone, 10);
  const b = F.focusAt(p, 27 * 60000);
  assert.equal(b.kind, 'break'); assert.equal(b.remainingMs, 3 * 60000); assert.equal(b.workMinDone, 25);
  const z = F.focusAt(p, F.planMinutes(p) * 60000 + 1);
  assert.ok(z.done); assert.equal(z.workMinDone, 60);
});
