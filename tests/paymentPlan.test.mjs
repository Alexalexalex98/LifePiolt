import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPaymentPlan } from '../src/lib/bills/paymentPlan.ts';

const rows = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(2026, 9 + i + 1, 0); return `${i + 1} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}     274.95`; }).join('\n');
test('piano di pagamento: righe «numero data importo»', () => {
  const p = detectPaymentPlan(`Rata N. Pagabile entro il Ammontare\n${rows(36)}\nImporto totale da pagare:   9’897.85\n`);
  assert.equal(p.installments.length, 36);
  assert.equal(p.installments[0].dueDate, '2026-10-31');
  assert.equal(p.installments[35].dueDate, '2029-09-30');
  assert.equal(p.statedTotal, 9897.85);
  assert.equal(p.everyMonths, 1);
});
test('ogni cella su una riga', () => {
  const t = '1\n31.10.2026\n100.00\n2\n30.11.2026\n100.00\n3\n31.12.2026\n100.50\nTotale';
  const p = detectPaymentPlan(t);
  assert.equal(p.installments.length, 3); assert.equal(p.total, 300.5);
});
test('una bolletta normale non è un piano', () => {
  assert.equal(detectPaymentPlan('Fattura 12 del 01.10.2026 scadenza 31.10.2026 totale 120.00'), null);
  assert.equal(detectPaymentPlan('1 31.10.2026 10.00\n3 30.11.2026 10.00'), null);
});

import { parseBillText } from '../src/lib/bills/parse.ts';
test('bolletta con piano di pagamento: totale, prima rata e nessuna scadenza ambigua', () => {
  const t = `Piano di pagamento concordato: 3 rate mensili\nEntro il 16.10.2026 restituisca il documento firmato.\nwww.swisscaution.ch\nRata N. Pagabile entro il Ammontare\n1 31.10.2026 100.00\n2 30.11.2026 100.00\n3 31.12.2026 100.50\nImporto totale da pagare: 300.50`;
  const d = parseBillText(t, { today: '2026-10-27' });
  assert.equal(d.plan?.installments.length, 3);
  assert.equal(d.amount?.value, 300.5);
  assert.equal(d.dueDate?.value, '2026-10-31');
  assert.equal(d.issuer?.value, 'Swisscaution');
  assert.equal(d.ambiguities.length, 0);
});
