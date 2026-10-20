import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGroup, allowedStarts, groupState, gymSlots, SMALL_GROUP } from '../src/lib/fitness/groups.ts';

const gym = { id: 'g1', name: 'Palestra Riva', kind: 'palestra' };
const base = { name: 'Corsa del mattino', kind: 'free', priceLP: 0, max: 10, gym, day: 1, hour: 10 };
test('gruppo grande in una fascia ammessa: va bene', () => assert.deepEqual(validateGroup(base, []), []));
test('gruppo grande fuori fascia: rifiutato con la fascia giusta', () => {
  const r = validateGroup({ ...base, hour: 19 }, []);
  assert.equal(r.length, 1); assert.match(r[0], /solo in queste fasce/);
});
test('fino a 5 persone nessuna restrizione di orario', () => assert.deepEqual(validateGroup({ ...base, max: SMALL_GROUP, hour: 19 }, []), []));
test('un solo gruppo grande per centro alla stessa ora', () => {
  const other = { gymId: 'g1', max: 12, day: 1, hour: 10 };
  assert.match(validateGroup(base, [other]).join(' '), /già un altro gruppo grande/);
  assert.deepEqual(validateGroup({ ...base, hour: 11 }, [other]), []);
});
test('massimo 30 persone; piscina al massimo 20', () => {
  assert.ok(validateGroup({ ...base, max: 31 }, []).length);
  assert.match(validateGroup({ ...base, gym: { id: 'p', name: 'Acquamarina', kind: 'piscina' }, max: 25 }, []).join(' '), /fino a 20/);
});
test('prezzo e nome obbligatori; senza centro nessuna fascia', () => {
  assert.ok(validateGroup({ ...base, kind: 'paid', priceLP: 0 }, []).length);
  assert.ok(validateGroup({ ...base, name: 'ab' }, []).length);
  assert.deepEqual(validateGroup({ ...base, gym: null, max: 30, day: undefined, hour: undefined }, []), []);
});
test('fasce e stati', () => {
  assert.ok(allowedStarts(gym).length > 20 && gymSlots(gym).length === 2);
  const g = { owner: 'A', kind: 'paid', members: ['A', 'B'], requests: [{ name: 'C', ts: 1 }], declined: ['D'], max: 2, paidUntil: { B: 100 } };
  assert.equal(groupState(g, 'A', 5), 'owner');
  assert.equal(groupState(g, 'B', 5), 'member');
  assert.equal(groupState(g, 'B', 500), 'expired');
  assert.equal(groupState(g, 'C', 5), 'pending');
  assert.equal(groupState(g, 'D', 5), 'declined');
  assert.equal(groupState(g, 'E', 5), 'full');
});
