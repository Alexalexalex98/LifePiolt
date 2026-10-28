import test from 'node:test';
import assert from 'node:assert/strict';
import { spendReport, everyText } from '../src/lib/spendingReport.ts';

const D = 86400000, t0 = Date.parse('2026-10-01');
const r = (d, label, amount, category, payee) => ({ ts: t0 + d * D, label, amount, category, payee });
const rows = [r(1, 'Coop', -50, 'Alimentari/Casa', 'coop'), r(4, 'Coop', -70, 'Alimentari/Casa', 'coop'), r(8, 'Coop', -60, 'Alimentari/Casa', 'coop'), r(2, 'Netflix', -20, 'Abbonamenti', 'netflix'), r(3, 'Stipendio', 4000, 'Altro', 'datore'), r(5, 'Fondo', -300, 'Fondo emergenza', 'fondo')];
test('categorie ordinate con percentuali, escluse entrate e categorie indicate', () => {
  const s = spendReport(rows, { exclude: ['Fondo emergenza'] });
  assert.equal(s.total, 200); assert.equal(s.categories[0].name, 'Alimentari/Casa'); assert.equal(s.categories[0].pct, 90); assert.equal(s.count, 4);
});
test('dove compri: totale, media e ogni quanto', () => {
  const p = spendReport(rows, { exclude: ['Fondo emergenza'] }).payees[0];
  assert.equal(p.name, 'Coop'); assert.equal(p.count, 3); assert.equal(p.total, 180); assert.equal(p.avg, 60); assert.equal(p.everyDays, 4);
});
test('frase sulla frequenza', () => { assert.equal(everyText(7, 5), 'ogni settimana'); assert.equal(everyText(0, 1), 'una volta'); assert.equal(everyText(30, 4), 'ogni mese'); assert.equal(everyText(3, 4), 'ogni 3 giorni'); });
