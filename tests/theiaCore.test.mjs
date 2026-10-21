import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtNum, numbersIn, unverifiedNumbers, verified, hhmm, toMin } from '../src/lib/theia/core.ts';

test('formato italiano dei numeri', () => {
  assert.equal(fmtNum(1234.5, 1), '1.234,5');
  assert.equal(fmtNum(1234567), '1.234.567');
  assert.equal(fmtNum(-509), '-509');
  assert.equal(fmtNum(7.5), '7,5');
});
test('numeri e orari nel testo', () => {
  assert.deepEqual(numbersIn('Hai speso 1.234,50 CHF e domani alle 06:00 hai 3 impegni'), ['1.234,50', '06:00', '3']);
});
test('verifica: i numeri senza origine vengono scoperti', () => {
  const facts = [{ label: 'saldo', value: 331, source: 's' }, { label: 'ore', value: 7.1, source: 's' }, { label: 'turno', value: '06:00', source: 's' }];
  assert.deepEqual(unverifiedNumbers('Il saldo è 331 CHF, hai dormito 7,1 ore, turno alle 06:00', facts), []);
  assert.deepEqual(unverifiedNumbers('Il saldo è 335 CHF', facts), ['335']);
  assert.deepEqual(unverifiedNumbers('Hai dormito 8 ore', facts), ['8']);
});
test('verifica: 1.234 e 1234 sono lo stesso valore', () => {
  const facts = [{ label: 'x', value: 1234, source: 's' }];
  assert.ok(verified({ text: 'Sono 1.234 CHF', facts, sources: [] }));
  assert.ok(!verified({ text: 'Sono 1.243 CHF', facts, sources: [] }));
});
test('orari', () => { assert.equal(hhmm(toMin('22:30') + 90), '00:00'); assert.equal(hhmm(-30), '23:30'); });
