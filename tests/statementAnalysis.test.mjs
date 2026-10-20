import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStatement, analyzeSalary, salaryMonthOf, salaryMonthLabel, classify } from '../src/lib/statementAnalysis.ts';

const R = { from: 20, to: 10 };
test('mese di stipendio: dal 20 al 10 del mese dopo', () => {
  assert.equal(salaryMonthOf('2026-09-20', R), '2026-09'); assert.equal(salaryMonthOf('2026-10-10', R), '2026-09');
  assert.equal(salaryMonthOf('2026-10-11', R), null); assert.equal(salaryMonthOf('2026-01-05', R), '2025-12');
  assert.equal(salaryMonthLabel('2026-09', R), 'settembre 2026 (20.09 – 10.10)');
});
const rows = [];
for (const [y, m] of [[2026, 5], [2026, 6], [2026, 7], [2026, 8], [2026, 9]]) {
  const mm = String(m).padStart(2, '0');
  rows.push({ date: `${y}-${mm}-27`, label: 'Accredito Acme SA', amount: 3000 });
  rows.push({ date: `${y}-${mm}-01`, label: 'Pagamento s.immo SA', amount: -1905 });
  rows.push({ date: `${y}-${mm}-08`, label: 'Pagamento CSS Kranken-Versicherung AG', amount: -505.95 });
  rows.push({ date: `${y}-${mm}-15`, label: 'Pagamento Bank Now AG', amount: -207.9 });
  for (let d = 2; d < 22; d += 3) rows.push({ date: `${y}-${mm}-${String(d).padStart(2, '0')}`, label: 'Acquisto TPL Palazzo Billett', amount: -2.6 });
  rows.push({ date: `${y}-${mm}-12`, label: 'Acquisto Coop-6148 Lugano', amount: -45 });
}
rows.push({ date: '2026-07-27', label: 'Pagamento estero Mario Rossi', amount: -5003 });
rows.push({ date: '2026-08-05', label: 'Deposito Bancomat Lugano', amount: 300 });
test('stipendio con finestra, depositi esclusi', () => {
  const s = analyzeSalary(rows, R);
  assert.equal(s.monthly, 3000); assert.equal(s.sources.length, 1); assert.ok(s.months.length >= 4);
});
test('spese fisse: affitto, cassa malati, prestito; non i biglietti del bus', () => {
  const a = analyzeStatement(rows, R);
  const names = a.fixed.map((f) => f.name);
  assert.ok(names.some((n) => /^Affitto/.test(n)) && names.some((n) => /Cassa malati/.test(n)) && names.some((n) => /Prestiti/.test(n)), names.join('|'));
  assert.ok(!names.some((n) => /tpl|billett/i.test(n)));
  assert.equal(a.fixed.find((f) => /^Affitto/.test(f.name)).monthly, 1905);
  assert.equal(a.extraordinary.length, 1); assert.equal(a.extraordinary[0].amount, -5003);
  assert.ok(a.variable.some((v) => v.name === 'Cibo'));
});
test('classificazione', () => { assert.equal(classify('Pagamento s.immo SA'), 'Affitto'); assert.equal(classify('Acquisto Coop Pronto'), 'Cibo'); assert.equal(classify('Pagamento CONCORDIA'), 'Cassa malati e assicurazioni'); });

test('regola della media: finestra di mesi e mediana/media aritmetica', () => {
  const rows = [];
  const pay = [3000, 3000, 3000, 3000, 6000, 3000];
  pay.forEach((a, i) => rows.push({ date: `2026-0${i + 1}-25`, label: 'Accredito · Azienda SA', amount: a }));
  const all = analyzeSalary(rows, { from: 20, to: 10 });
  assert.equal(all.used, 6);
  assert.equal(all.monthly, 3000);
  const mean = analyzeSalary(rows, { from: 20, to: 10 }, [], { window: 0, method: 'mean' });
  assert.equal(mean.monthly, 3500);
  const last3 = analyzeSalary(rows, { from: 20, to: 10 }, [], { window: 3, method: 'mean' });
  assert.equal(last3.used, 3);
  assert.equal(last3.monthly, 4000);
  assert.equal(last3.months.filter((m) => m.used).length, 3);
});
