import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../src/lib/invoice.ts';
import * as B from '../src/lib/booking.ts';

const H = 3600000;
const enr = { id: 'eabc', kind: 'seminar', title: 'Budget', host: 'Anna', price: 25, paid: 25, held: true, startsAt: 100 * H, durationMin: 90, createdAt: 10 * H };
test('i LifePoints restano bloccati fino alla fine, poi accreditati', () => {
  assert.equal(B.escrowState(enr, 50 * H), 'bloccato');
  assert.equal(B.escrowState(enr, 101 * H), 'bloccato'); // evento in corso
  assert.equal(B.escrowState(enr, 100 * H + 91 * 60000), 'accreditato');
  assert.equal(B.escrowState({ ...enr, releasedAt: 1 }, 50 * H), 'accreditato');
  assert.equal(B.escrowState({ ...enr, paid: 0 }, 0), 'nessuno');
  assert.equal(B.unlockAt(enr), 100 * H + 90 * 60000);
});
test('numero fattura stabile e formattato', () => {
  const a = I.invoiceNumber('eabc', Date.UTC(2026, 9, 12));
  assert.match(a, /^LP-2026-\d{6}$/);
  assert.equal(a, I.invoiceNumber('eabc', Date.UTC(2026, 9, 12)));
  assert.notEqual(a, I.invoiceNumber('eabd', Date.UTC(2026, 9, 12)));
});
test('fattura da iscrizione e da ordine', () => {
  const inv = I.invoiceFromEnrollment(enr, 'Bea', 50 * H);
  assert.equal(inv.state, 'bloccato');
  assert.equal(inv.paid, 25);
  assert.equal(inv.seller, 'Anna');
  assert.match(I.invoiceText(inv), /Bloccato fino alla fine/);
  const o = I.invoiceFromOrder({ id: 'or1', shop: 'Shop', name: 'Scarpe', qty: 1, total: 120, credit: 50, paid: 70, ts: 5 }, 'Bea');
  assert.equal(o.state, 'pagato');
  assert.equal(o.discount, 50);
  assert.match(I.invoiceText(o), /Sconto: -50 LP/);
});
