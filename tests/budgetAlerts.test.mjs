import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetAlerts, budgetSuggestions } from '../src/lib/budgetAlerts.ts';

const guidelines = { Affitto: 30, 'Alimentari/Casa': 12, Abbonamenti: 3, 'Fondo emergenza': 10 };
test('supera il budget impostato: importo e percentuale', () => {
  const a = budgetAlerts({ spent: { 'Alimentari/Casa': 900 }, alloc: { 'Alimentari/Casa': 600 }, guidelines, salary: 6500 });
  assert.equal(a.length, 1);
  assert.equal(a[0].level, 'over'); assert.equal(a[0].basis, 'budget');
  assert.equal(a[0].over, 300); assert.equal(a[0].pct, 150);
  assert.match(a[0].text, /superato il budget di 300 CHF/);
});
test('senza budget usa la linea guida (% dello stipendio)', () => {
  const a = budgetAlerts({ spent: { Abbonamenti: 250 }, alloc: {}, guidelines, salary: 6500 });
  assert.equal(a[0].limit, 195); assert.equal(a[0].basis, 'linea guida'); assert.equal(a[0].pct, 128);
});
test('sotto il limite: nessun avviso; vicino: avviso soft; il fondo emergenza non conta', () => {
  assert.equal(budgetAlerts({ spent: { 'Alimentari/Casa': 400 }, alloc: { 'Alimentari/Casa': 600 }, guidelines, salary: 6500 }).length, 0);
  const near = budgetAlerts({ spent: { 'Alimentari/Casa': 540 }, alloc: { 'Alimentari/Casa': 600 }, guidelines, salary: 6500 });
  assert.equal(near[0].level, 'near'); assert.equal(near[0].pct, 90);
  assert.equal(budgetAlerts({ spent: { 'Fondo emergenza': 5000 }, alloc: { 'Fondo emergenza': 100 }, guidelines, salary: 6500 }).length, 0);
});
test('senza stipendio ne budget: niente avvisi inventati', () => {
  assert.equal(budgetAlerts({ spent: { Affitto: 1400 }, alloc: {}, guidelines, salary: 0 }).length, 0);
});
test('ordine: prima i superamenti piu grandi; suggerimenti Theia solo per i superamenti', () => {
  const a = budgetAlerts({ spent: { Affitto: 2200, 'Alimentari/Casa': 560, Abbonamenti: 400 }, alloc: { 'Alimentari/Casa': 600 }, guidelines, salary: 6500 });
  assert.deepEqual(a.map((x) => x.category), ['Abbonamenti', 'Affitto', 'Alimentari/Casa']);
  const s = budgetSuggestions(a);
  assert.equal(s.length, 2); assert.ok(s.every((x) => x.id.startsWith('budget-')));
});
