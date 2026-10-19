import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForecast, ymLabel } from '../src/lib/statementForecast.ts';

const rows = [];
for (const m of ['01', '02', '03', '04', '05', '06']) {
  rows.push({ date: `2026-${m}-27`, label: 'Accredito Acme SA', amount: 3000 });
  rows.push({ date: `2026-${m}-01`, label: 'Pagamento s.immo SA', amount: -1500 });
  rows.push({ date: `2026-${m}-08`, label: 'Pagamento CSS Kranken-Versicherung AG', amount: -400 });
  rows.push({ date: `2026-${m}-12`, label: 'Acquisto Coop Lugano', amount: -300 });
}
rows.push({ date: '2026-03-10', label: 'Deposito Bancomat Lugano', amount: 500 });
rows.push({ date: '2026-04-15', label: 'Pagamento Ufficio di esecuzione Lugano', amount: -2500 });
test('storico per mese: entrate ricorrenti e occasionali, fisse, variabili, straordinarie', () => {
  const f = buildForecast(rows, undefined, undefined, new Date('2026-07-15'));
  const mar = f.history.find((m) => m.ym === '2026-03'), apr = f.history.find((m) => m.ym === '2026-04');
  assert.equal(mar.income, 3500); assert.equal(mar.recurringIncome, 3000); assert.equal(mar.occasionalIncome, 500);
  assert.equal(mar.fixed, 1900); assert.equal(mar.variable, 300); assert.equal(apr.extraordinary, 2500);
});
test('previsione: ricorrenti + media del resto; i straordinari non sono previsti ma avvisati', () => {
  const f = buildForecast(rows, undefined, undefined, new Date('2026-07-15'));
  assert.equal(f.next[0].ym, '2026-07'); assert.equal(f.next.length, 3);
  assert.equal(f.next[0].fixed, 1900); assert.equal(f.next[0].variable, 300); assert.equal(f.next[0].income, 3000 + f.occasionalMonthly);
  assert.equal(f.next[0].net, f.next[0].income - 2200); assert.ok(f.next[0].low <= f.next[0].net && f.next[0].net <= f.next[0].high);
  assert.equal(f.reliability, 'buona'); assert.ok(f.scenarios.length >= 1);
  assert.equal(ymLabel('2026-07'), 'luglio 2026'); assert.equal(buildForecast([], undefined, undefined), null);
});
