import test from 'node:test';
import assert from 'node:assert/strict';
import { monthCalc } from '../src/lib/financeCalc.ts';

const m = { label: 'Ottobre', start: 5000, movements: [
  { label: 'Stipendio', amount: 3500 }, { label: 'Affitto', amount: -1400 }, { label: 'Cassa malati', amount: -480 },
  { label: 'Alimentari/Casa · Coop', amount: -110 }, { label: 'Alimentari/Casa · Elettricità', amount: -55 },
  { label: 'Fondo emergenza', amount: -150 }, { label: 'Altro · Ristorante', amount: -45 },
] };
const cat = (l) => (/affitto/i.test(l) ? 'Affitto' : /cassa/i.test(l) ? 'Cassa malati' : /fondo/i.test(l) ? 'Fondo emergenza' : /alimentari/i.test(l) ? 'Alimentari/Casa' : 'Altro');

test('calcolo del mese: stipendio 3500, affitto 1400, cassa malati 480', () => {
  const c = monthCalc(m, cat, { Affitto: 1400, 'Cassa malati': 480, 'Alimentari/Casa': 500, 'Fondo emergenza': 150, Altro: 300 });
  assert.equal(c.income, 3500);
  assert.equal(c.fixedTotal, 1400 + 480 + 55);
  assert.equal(c.variableTotal, 155);
  assert.equal(c.emergency, 150);
  assert.equal(c.expenses, 2090);
  assert.equal(c.left, 3500 - 2090 - 150);
  assert.equal(c.end, 5000 + 3500 - 2090 - 150);
  assert.equal(c.savedPct, Math.round(((150 + 1260) / 3500) * 1000) / 10);
  const food = c.byCategory.find((x) => x.name === 'Alimentari/Casa');
  assert.equal(food.spent, 165); assert.equal(food.left, 335);
});
test('mese senza movimenti', () => {
  const c = monthCalc({ label: 'x', start: 100, movements: [] }, cat, {});
  assert.equal(c.left, 0); assert.equal(c.end, 100); assert.equal(c.savedPct, 0);
});
