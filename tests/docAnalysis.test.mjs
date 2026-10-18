import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAnalysis, isBillType } from '../src/lib/docAnalysis.ts';

const sample = {
  tipo: 'altro', riassunto: 'Estratto conto con tre fatture non saldate.',
  dettagli: [{ voce: 'Emittente', valore: 'Società Fiduciaria e Consulenza SA' }, { voce: 'Fattura Nr. 249/2025', valore: "1'405.30 CHF (scaduta il 31/01/2026)" }, { voce: 'Fattura Nr. 034/2026', valore: "1'621.50 CHF (scaduta il 09/04/2026)" }],
  date: [{ etichetta: 'Scadenza fattura 249/2025', data: '2026-01-31' }, { etichetta: 'Scadenza fattura 034/2026', data: '2026-04-09' }],
  importi: [{ etichetta: 'Fattura 249/2025', valore: 1405.3, valuta: 'CHF' }, { etichetta: 'Fattura 034/2026', valore: 1621.5, valuta: 'CHF' }, { etichetta: 'Saldo totale scaduto', valore: 4648.3, valuta: 'CHF' }],
  persone_enti: ['Società Fiduciaria e Consulenza SA'],
  azioni: [{ azione: 'Verificare lo stato dei pagamenti', entro: '2026-10-25' }],
  decisione: { consiglio: 'Controllare i registri.', da_verificare: ['Pagamenti successivi'] }, non_leggibile: [],
};
test('estratto conto: testo leggibile e fatture da proporre', () => {
  const d = describeAnalysis(sample);
  assert.equal(d.invoices.length, 2);
  assert.deepEqual(d.invoices[0], { issuer: 'Società Fiduciaria e Consulenza SA', amount: 1405.3, currency: 'CHF', number: '249/2025', dueDate: '2026-01-31', label: 'Fattura 249/2025' });
  assert.match(d.text, /Cosa farei/); assert.match(d.text, /25\.10\.2026/); assert.doesNotMatch(d.text, /[{}"]/);
});
test('risposte vuote o non strutturate', () => {
  assert.equal(describeAnalysis(null), null); assert.equal(describeAnalysis('testo'), null); assert.equal(describeAnalysis({}), null);
});
test('tipo bolletta o fattura', () => { assert.ok(isBillType('bolletta')); assert.ok(isBillType('Fattura')); assert.ok(!isBillType('altro')); });
