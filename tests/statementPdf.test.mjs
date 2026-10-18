import test from 'node:test';
import assert from 'node:assert/strict';
import { movesToCsv, parseStatementReply } from '../src/lib/statementPdf.ts';
import { parseCsv } from '../src/lib/csvImport.ts';

test('legge i movimenti dalla risposta dell\'AI, anche in un blocco di codice, e scarta quelli non validi', () => {
  const r = parseStatementReply('```json\n[{"data":"2026-10-03","descrizione":"Coop; Lugano","importo":-45.9},{"data":"03.10.2026","descrizione":"x","importo":1},{"data":"2026-10-05","descrizione":"Stipendio","importo":"4\'200,50"},{"data":"2026-10-06","descrizione":"","importo":5}]\n```');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { date: '2026-10-03', label: 'Coop Lugano', amount: -45.9 });
  assert.equal(r[1].amount, 4200.5);
});
test('risposte vuote o senza elenco', () => { assert.deepEqual(parseStatementReply(''), []); assert.deepEqual(parseStatementReply('Non è un estratto'), []); assert.deepEqual(parseStatementReply('[]'), []); });
test('il CSV prodotto e\' letto dall\'importazione con date, descrizioni e importi giusti', () => {
  const csv = movesToCsv([{ date: '2026-10-03', label: 'Coop Lugano', amount: -45.9 }, { date: '2026-10-05', label: 'Stipendio', amount: 4200.5 }]);
  const p = parseCsv(csv, ['Spesa']);
  assert.equal(p.rows.length, 2);
  assert.equal(p.rows[0].date, '2026-10-03'); assert.equal(p.rows[0].amount, -45.9); assert.equal(p.rows[1].amount, 4200.5);
});
