import test from 'node:test';
import assert from 'node:assert/strict';
import { insightsOf, detectIncome } from '../src/lib/statementInsights.ts';

const rows = [];
for (const m of ['05', '06', '07', '08']) {
  rows.push({ date: `2026-${m}-27`, label: 'Accredito Acme SA', amount: 3000 });
  rows.push({ date: `2026-${m}-01`, label: 'Affitto Immobiliare Rossi', amount: -1400 });
  rows.push({ date: `2026-${m}-12`, label: 'Deposito Bancomat BR Lugano', amount: 200 });
}
rows.push({ date: '2026-07-10', label: 'Accredito Mario Verdi', amount: 50 });
test('stipendio mensile da entrate ricorrenti, senza depositi e senza una tantum', () => {
  const s = detectIncome(rows);
  assert.equal(s.length, 1); assert.equal(s[0].monthly, 3000); assert.equal(s[0].months, 4);
});
test('riepilogo: periodo, totali, stipendio e spese fisse', () => {
  const r = insightsOf(rows);
  assert.equal(r.count, 13); assert.equal(r.from, '2026-05-01'); assert.equal(r.to, '2026-08-27');
  assert.equal(r.salary, 3000); assert.equal(r.expense, 5600);
  assert.ok(r.fixed.some((f) => /affitto/i.test(f.name) && f.amount === 1400));
  assert.equal(insightsOf([]), null);
});
