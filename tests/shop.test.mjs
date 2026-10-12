import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/lib/shop.ts';

const H = 3600000;
test('sconto da contributo', () => {
  assert.deepEqual(S.applyCredit(120, 50), { used: 50, pay: 70 });
  assert.deepEqual(S.applyCredit(30, 50), { used: 30, pay: 0 });
  assert.deepEqual(S.applyCredit(30, -5), { used: 0, pay: 30 });
});
test('stato dell\'ordine nel tempo e reso', () => {
  const o = { ts: 0, status: 'pagato' };
  assert.equal(S.statusAt(o, 1 * H), 'pagato');
  assert.equal(S.statusAt(o, 30 * H), 'spedito');
  assert.equal(S.statusAt(o, 80 * H), 'consegnato');
  assert.equal(S.canReturn(o, 30 * H), false);
  assert.equal(S.canReturn(o, 80 * H), true);
  assert.equal(S.canReturn(o, (72 + 15 * 24) * H), false);
  assert.equal(S.statusAt({ ...o, returnedAt: 5 }, 80 * H), 'reso');
  assert.equal(S.canReturn({ ...o, returnedAt: 5 }, 80 * H), false);
});
test('validazioni', () => {
  assert.ok(S.validateProduct({ name: 'a', price: 5, stock: 1 }));
  assert.ok(S.validateProduct({ name: 'Scarpe', price: 0, stock: 1 }));
  assert.equal(S.validateProduct({ name: 'Scarpe', price: 90, stock: 3 }), null);
  assert.ok(S.validateAddress('Via 1'));
  assert.equal(S.validateAddress('Via Roma 12, 6900 Lugano'), null);
});
test('controlli d\'acquisto', () => {
  const p = { id: 'p', shop: 's', name: 'x', desc: '', price: 50, stock: 2, color: '#fff', ts: 0 };
  assert.equal(S.buyBlockReason(p, 1, 100, 50), null);
  assert.match(S.buyBlockReason(p, 3, 100, 150), /restano solo 2/);
  assert.match(S.buyBlockReason({ ...p, stock: 0 }, 1, 100, 50), /esaurito/);
  assert.match(S.buyBlockReason(p, 1, 10, 50), /insufficienti/);
  assert.ok(S.buyBlockReason(undefined, 1, 10, 50));
});
