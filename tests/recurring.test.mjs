import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRecurring, normalizeLabel, movementsToDated } from '../src/lib/recurring.ts';

const mv = (date, label, amount) => ({ date, label, amount });
const months = [
  { label: 'Ottobre 2026', movements: [mv('02/10', 'Affitto · Immobiliare Rossi', -1400), mv('05/10', 'Abbonamenti · Netflix', -15.9), mv('03/10', 'Alimentari/Casa · Migros Lugano', -87.45), mv('25/10', 'Stipendio', 6500)] },
  { label: 'Settembre 2026', movements: [mv('02/09', 'Affitto · Immobiliare Rossi', -1400), mv('05/09', 'Abbonamenti · Netflix', -15.9), mv('11/09', 'Alimentari/Casa · Migros Lugano', -64.2), mv('25/09', 'Stipendio', 6500)] },
  { label: 'Agosto 2026', movements: [mv('02/08', 'Affitto · Immobiliare Rossi', -1400), mv('06/08', 'Abbonamenti · Netflix', -15.9), mv('19/08', 'Alimentari/Casa · Migros Lugano', -120.1), mv('25/08', 'Stipendio', 6500), mv('15/08', 'Regalo', -50)] },
];
test('normalizeLabel: toglie categoria, date e numeri', () => {
  assert.equal(normalizeLabel('Abbonamenti · Netflix'), 'netflix');
  assert.equal(normalizeLabel('Pagamento carta di debito Migros Lugano 12.10.2026'), 'migros lugano');
  assert.equal(normalizeLabel('Affitto ottobre'), 'affitto');
});
test('trova affitto e Netflix (mensili), non la spesa variabile ne lo stipendio', () => {
  const r = detectRecurring(movementsToDated(months));
  const names = r.map((x) => x.name);
  assert.ok(names.includes('Netflix') && names.includes('Immobiliare Rossi'), names.join(','));
  assert.ok(!names.some((n) => /migros/i.test(n)), 'la spesa con importi molto diversi non e ricorrente');
  assert.ok(!names.includes('Stipendio') && !names.includes('Regalo'));
  const nf = r.find((x) => x.name === 'Netflix');
  assert.equal(nf.freq, 'monthly'); assert.equal(nf.amount, 15.9); assert.equal(nf.count, 3);
});
test('non ripropone cio che e gia nelle bollette', () => {
  const r = detectRecurring(movementsToDated(months), ['Netflix', 'Affitto']);
  assert.ok(!r.some((x) => x.name === 'Netflix'));
});
test('un solo pagamento o mesi non consecutivi non bastano', () => {
  assert.equal(detectRecurring([mv('2026-10-05', 'Netflix', -15.9)]).length, 0);
  assert.equal(detectRecurring([mv('2026-05-05', 'Corso', -100), mv('2026-10-05', 'Corso', -100)]).length, 0);
});
test('annuale: due pagamenti a un anno di distanza', () => {
  const r = detectRecurring([mv('2025-03-10', 'Serafe canone', -335), mv('2026-03-12', 'Serafe canone', -335)]);
  assert.equal(r.length, 1); assert.equal(r[0].freq, 'yearly');
});
test('importo che cambia poco (+10%) resta ricorrente; mediana come importo', () => {
  const r = detectRecurring([mv('2026-07-02', 'Cassa X premio', -380), mv('2026-08-02', 'Cassa X premio', -385), mv('2026-09-02', 'Cassa X premio', -420)]);
  assert.equal(r.length, 1); assert.equal(r[0].amount, 385);
});
