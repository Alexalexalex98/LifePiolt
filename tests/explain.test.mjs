import test from 'node:test';
import assert from 'node:assert/strict';
import { listMovements, sumRows } from '../src/lib/explain.ts';
const months = [{ label: 'Ottobre 2026', start: 0, movements: [{ date: '18/10', label: 'Alimentari/Casa · Coop', amount: -33 }, { date: '05/10', label: 'Stipendio Acme', amount: 3000 }] }, { label: 'Settembre 2026', start: 0, movements: [{ date: '27/09', label: 'Stipendio Acme', amount: 3000 }] }];
test('movimenti di un filtro, dal piu\' recente, con la data completa', () => {
  const r = listMovements(months, (x) => x.amount > 0);
  assert.deepEqual(r.map((x) => x.date), ['05.10.2026', '27.09.2026']);
  assert.equal(sumRows(r), 6000);
  assert.equal(listMovements(months, (x) => x.amount < 0)[0].label, 'Coop');
});
