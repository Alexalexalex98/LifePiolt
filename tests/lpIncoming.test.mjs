import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIncoming, pendingTotal, dueIncoming, markCredited, reverseIncoming, totalWithPending } from '../src/lib/lpIncoming.ts';

const NOW = 1_800_000_000_000;
test('un arrivo senza blocco è subito accreditato; con blocco resta in attesa', () => {
  assert.equal(makeIncoming({ id: 'a', now: NOW, from: 'Anna', label: 'x', amount: 1, source: 'giornaliero' }).status, 'credited');
  const h = makeIncoming({ id: 'b', now: NOW, from: 'Anna', label: 'x', amount: 40, source: 'iscrizioni', releaseAt: NOW + 3600000 });
  assert.equal(h.status, 'pending'); assert.equal(h.releaseAt, NOW + 3600000);
  assert.equal(makeIncoming({ id: 'c', now: NOW, from: 'Anna', label: 'x', amount: 0, source: 'altro' }), null);
  assert.equal(makeIncoming({ id: 'c', now: NOW, from: ' ', label: 'x', amount: 5, source: 'altro' }), null);
});
test('totale in arrivo, scadenze e accredito', () => {
  const l = [makeIncoming({ id: 'b', now: NOW, from: 'A', label: '', amount: 40, source: 'iscrizioni', releaseAt: NOW + 1000 }), makeIncoming({ id: 'c', now: NOW, from: 'B', label: '', amount: 10.5, source: 'pagamenti', releaseAt: NOW + 9e6 })];
  assert.equal(pendingTotal(l), 50.5); assert.equal(totalWithPending(100, l), 150.5);
  assert.deepEqual(dueIncoming(l, NOW + 2000).map((i) => i.id), ['b']);
  const m = markCredited(l, ['b']); assert.equal(pendingTotal(m), 10.5); assert.equal(m[0].status, 'credited');
});
test('annullamento: se già accreditato si toglie dal conto, se bloccato sparisce solo', () => {
  const l = [makeIncoming({ id: 'a', now: NOW, from: 'A', label: '', amount: 20, source: 'pagamenti' }), makeIncoming({ id: 'b', now: NOW, from: 'B', label: '', amount: 40, source: 'iscrizioni', releaseAt: NOW + 5000 })];
  const r1 = reverseIncoming(l, 'a'); assert.equal(r1.deduct, 20); assert.equal(r1.list[0].status, 'reversed');
  const r2 = reverseIncoming(l, 'b'); assert.equal(r2.deduct, 0); assert.equal(pendingTotal(r2.list), 0);
  assert.equal(reverseIncoming(r1.list, 'a').found, null);
});
