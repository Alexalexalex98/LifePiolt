import test from 'node:test';
import assert from 'node:assert/strict';
import { balance, byCategory, budgetStatus, monthlyCost, subsMonthly, nextCharge, subsDue, taxDeadlines, taxSoon, expenseTotals, accountantCsv, accountantSummary, toPay } from '../src/lib/money.ts';

const E = (o) => ({ id: 'e', team_id: 't', day: '2026-11-03', kind: 'out', category: 'Affitto', description: 'x', amount: 100, currency: 'CHF', project: null, doc_id: null, ...o });
test('cassa e categorie', () => {
  const l = [E({ kind: 'in', amount: 1000, category: 'Vendite' }), E({ amount: 400 }), E({ amount: 100, category: 'Utenze' }), E({ amount: 50, currency: 'EUR' }), E({ amount: 70, day: '2026-12-01' })];
  assert.deepEqual(balance(l, 'CHF'), { inn: 1000, out: 570, net: 430 }); assert.deepEqual(balance(l, 'CHF', '2026-11-30'), { inn: 1000, out: 500, net: 500 });
  assert.deepEqual(byCategory(l, 'out', 'CHF')[0], { category: 'Affitto', total: 470 });
});
test('budget contro speso, mese e anno', () => {
  const b = [{ id: '1', team_id: 't', project: null, category: 'Affitto', period: '2026-11', amount: 300, currency: 'CHF' }, { id: '2', team_id: 't', project: null, category: 'Utenze', period: '2026', amount: 1200, currency: 'CHF' }];
  const s = budgetStatus(b, [E({ amount: 400 }), E({ category: 'Utenze', amount: 120 })], '2026-11', 'CHF');
  assert.deepEqual(s.find((x) => x.category === 'Affitto'), { category: 'Affitto', budget: 300, spent: 400, pct: 133, over: true }); assert.equal(s.find((x) => x.category === 'Utenze').pct, 10);
});
test('abbonamenti: costo mensile e prossimo addebito', () => {
  const S = (o) => ({ id: 's', team_id: 't', name: 'x', vendor: '', category: 'Abbonamenti', amount: 120, currency: 'CHF', cycle: 'year', next_date: '2026-09-15', active: true, ...o });
  assert.equal(monthlyCost(S()), 10); assert.equal(monthlyCost(S({ cycle: 'quarter', amount: 90 })), 30);
  assert.equal(subsMonthly([S(), S({ cycle: 'month', amount: 20 }), S({ active: false })], 'CHF'), 30);
  assert.equal(nextCharge(S(), '2026-11-05'), '2027-09-15'); assert.equal(nextCharge(S({ cycle: 'month', next_date: '2026-10-31' }), '2026-11-05'), '2026-11-30'); assert.equal(nextCharge(S({ next_date: null }), '2026-11-05'), null);
  assert.equal(subsDue([S({ cycle: 'month', next_date: '2026-11-20' }), S()], '2026-11-05', 30).length, 1);
});
test('scadenze fiscali Italia e Svizzera', () => {
  const it = taxDeadlines('IT', 2026); assert.ok(it.some((t) => t.day === '2026-04-30' && /IVA annuale/.test(t.title))); assert.equal(it.filter((t) => /F24/.test(t.title)).length, 12);
  assert.equal(taxDeadlines('IT', 2026, { vat: 'quarter' }).filter((t) => /IVA/.test(t.title) && /trimestre/.test(t.title)).length, 4);
  const ch = taxDeadlines('CH', 2028); assert.ok(ch.some((t) => t.day === '2028-02-29')); assert.ok(ch.some((t) => /AVS/.test(t.title)));
  assert.ok(taxSoon(it, '2026-11-05', 45).some((t) => t.day === '2026-11-16'));
});
test('note spese, commercialista, da pagare', () => {
  const X = (o) => ({ id: 'x', team_id: 't', user_id: 'u', day: '2026-11-02', category: 'Pasti', description: 'Pranzo', amount: 30, currency: 'CHF', project: null, receipt_path: null, status: 'submitted', note: '', ...o });
  assert.deepEqual(expenseTotals([X(), X({ status: 'approved', amount: 20 }), X({ status: 'paid', amount: 10 })], 'CHF'), { submitted: 30, approved: 20, paid: 10 });
  const csv = accountantCsv([E({ amount: 99.5, description: 'Affitto "ufficio"' })], [X({ status: 'approved', receipt_path: 'p' }), X({ status: 'rejected' })], '2026-11');
  assert.match(csv, /^﻿Data;Tipo/); assert.match(csv, /2026-11-03;Uscita;"Affitto";"Affitto ""ufficio""";99,50;CHF/); assert.match(csv, /Nota spese;"Pasti";"Pranzo";30,00;CHF;scontrino allegato/); assert.equal(csv.split('\r\n').length, 3);
  assert.match(accountantSummary([E({ amount: 99.5 })], [], '2026-11', 'CHF'), /Uscite: 99,50 CHF/);
  const p = toPay([{ kind: 'invoice', status: 'new', amount: 100, currency: 'CHF', due: '2026-10-01' }, { kind: 'bill', status: 'new', amount: 50, currency: 'CHF', due: '2026-12-01' }, { kind: 'invoice', status: 'paid', amount: 999, currency: 'CHF', due: null }, { kind: 'cv', status: 'new', amount: 5, currency: 'CHF', due: null }], '2026-11-05');
  assert.deepEqual(p.CHF, { open: 150, late: 100, count: 2 });
});
