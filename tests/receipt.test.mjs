import test from 'node:test';
import assert from 'node:assert/strict';
import { isoFromInput, parseReceipt } from '../src/lib/receipt.ts';
test('scontrino: negozio, data e totale', () => {
  assert.deepEqual(parseReceipt('```json\n{"negozio":"Coop Lugano","data":"2026-10-19","totale":"32,30","valuta":"chf"}\n```'), { shop: 'Coop Lugano', date: '2026-10-19', total: 32.3, currency: 'CHF' });
  assert.equal(parseReceipt('{}'), null); assert.equal(parseReceipt('non è uno scontrino'), null);
  assert.equal(parseReceipt('{"negozio":"X","totale":0}'), null);
});
test('data scritta dall\'utente', () => {
  assert.equal(isoFromInput('19.10.2026'), '2026-10-19'); assert.equal(isoFromInput('5/3/26'), '2026-03-05'); assert.equal(isoFromInput('2026-10-19'), '2026-10-19'); assert.equal(isoFromInput('boh'), null);
});
