import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/lib/payments.ts';

test('commissione del 2,5% solo se si riceve in denaro, a carico di chi riceve', () => {
  assert.deepEqual(P.splitPayment(100, 'lp'), { gross: 100, fee: 0, net: 100 });
  assert.deepEqual(P.splitPayment(100, 'cash'), { gross: 100, fee: 2.5, net: 97.5 });
  assert.deepEqual(P.splitPayment(50, 'cash'), { gross: 50, fee: 1.25, net: 48.75 });
  assert.deepEqual(P.splitPayment(-5, 'cash'), { gross: 0, fee: 0, net: 0 });
});
test('controlli prima di inviare', () => {
  const ok = { from: 'Anna', to: 'Bea', amount: 10, balance: 50 };
  assert.equal(P.sendBlockReason(ok), null);
  assert.ok(P.sendBlockReason({ ...ok, to: 'Anna' }));
  assert.ok(P.sendBlockReason({ ...ok, to: ' ' }));
  assert.ok(P.sendBlockReason({ ...ok, amount: 0 }));
  assert.ok(P.sendBlockReason({ ...ok, amount: 2.5 }));
  assert.ok(P.sendBlockReason({ ...ok, amount: 51 }));
  assert.ok(P.sendBlockReason({ ...ok, amount: P.MAX_PAY + 1, balance: 1e9 }));
});
test('link di pagamento: andata e ritorno, e codici non validi rifiutati', () => {
  const l = P.buildPayLink({ to: 'Anna Rossi', amount: 50, mode: 'cash' });
  assert.equal(l, 'lp://pay/Anna%20Rossi?a=50&m=c');
  assert.deepEqual(P.parsePayLink(l), { to: 'Anna Rossi', amount: 50, mode: 'cash' });
  assert.deepEqual(P.parsePayLink(P.buildPayLink({ to: 'Bea', mode: 'lp' })), { to: 'Bea', mode: 'lp' });
  assert.equal(P.parsePayLink('https://esempio.it/pay/Anna'), null);
  assert.equal(P.parsePayLink('lp://pay/'), null);
  assert.equal(P.parsePayLink('lp://pay/Anna?a=-5'), null);
  assert.equal(P.parsePayLink('lp://pay/Anna?a=1.5'), null);
  assert.equal(P.parsePayLink('lp://pay/%3Cscript%3E'), null);
  assert.equal(P.parsePayLink(null), null);
  assert.ok(P.payLinkFits(l));
  assert.equal(P.payLinkFits('lp://pay/' + 'a'.repeat(120)), false);
});
