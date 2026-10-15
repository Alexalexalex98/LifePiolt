import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, applyConversion, payToken, DEMO_RATES } from '../src/lib/lifepay.ts';

test('conversione cripto → LP: commissione 1% e arrotondamento per difetto', () => {
  const q = quote('ETH', 0.5, 1);
  assert.equal(q.ok, true); assert.equal(q.gross, 1550); assert.equal(q.fee, 15.5); assert.equal(q.lp, 1534.5);
});
test('rifiuta quantità non valide, saldo insufficiente e importi minimi', () => {
  assert.equal(quote('BTC', 0, 1).ok, false);
  assert.equal(quote('BTC', NaN, 1).ok, false);
  assert.match(quote('BTC', 2, 1).reason, /abbastanza/);
  assert.match(quote('BTC', 0.00001, 1).reason, /piccolo/);
  assert.equal(quote('USDC', 5, 10, { ...DEMO_RATES, USDC: 0 }).ok, false);
});
test('il saldo cripto scende e non va mai sotto zero', () => {
  assert.equal(applyConversion({ ETH: 1 }, 'ETH', 0.4).ETH, 0.6);
  assert.equal(applyConversion({ ETH: 1 }, 'ETH', 5).ETH, 0);
});
test('il codice di pagamento cambia ogni minuto', () => {
  assert.equal(payToken(60000), payToken(119999)); assert.notEqual(payToken(60000), payToken(120000));
});
