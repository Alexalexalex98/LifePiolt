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

import { chunkLines, statementChunkPrompt, statementLines } from '../src/lib/statementPdf.ts';
test('dal testo di un PDF tiene solo le righe dei movimenti e ricava l\'anno', () => {
  const text = 'Raiffeisen Banca\nMario Rossi\nCH58 0079 1123 0008 8901 2\nEstratto conto 01.10.2026 - 31.10.2026\n03.10 Coop Lugano 45.90 1\'204.10\n05.10 Stipendio Acme SA 4\'200.00 5\'404.10\nSaldo finale 5\'404.10';
  const r = statementLines(text);
  assert.equal(r.lines.length, 3); assert.equal(r.year, 2026);
  assert.ok(!r.lines.some((l) => /Mario|CH58/.test(l)));
});
test('spezza in blocchi e costruisce la richiesta', () => {
  const lines = Array.from({ length: 200 }, (_, i) => `03.10 Movimento numero ${i} 12.50 100.00`);
  const parts = chunkLines(lines, 2000);
  assert.ok(parts.length > 3); assert.equal(parts.flat().length, 200);
  assert.match(statementChunkPrompt(parts[0], 2026), /2026/);
});

import { parseTableStatement } from '../src/lib/statementPdf.ts';
import { ascii85 } from '../src/lib/bills/pdfText.ts';
test('ASCII85', () => {
  assert.equal(Buffer.from(ascii85(Buffer.from('<~87cURD]j7BEbo7~>'))).toString(), 'Hello world');
  assert.equal(Buffer.from(ascii85(Buffer.from('87cURD]i,"Ebo80+T~>'))).toString(), 'Hello World!!');
  assert.equal(Buffer.from(ascii85(Buffer.from('@:E_W~>'))).toString(), 'abcd');
});
test('tabella con colonne Addebito/Accredito: il segno viene dalla colonna', () => {
  const run = (x, y, text) => ({ x, y, text });
  const page = {
    runs: [run(60, 669, 'Data'), run(118, 669, 'Testo'), run(324, 669, 'Addebito'), run(390, 669, 'Accredito'), run(520, 669, 'Valuta'),
      run(60, 657, '18.10.2026'), run(118, 657, 'Coop Lugano'), run(339, 657, '33.00'),
      run(118, 645, '16.10.2026, 08:16, N. carta Visa'),
      run(60, 633, '19.10.2026'), run(118, 633, 'Accredito Acme SA'), run(410, 633, "4'200.50"), run(505, 633, '19.10.2026'),
      run(60, 621, '20.10.2026'), run(118, 621, 'Saldo finale'), run(339, 621, '10.00')],
    rects: [{ x: 56, y: 677, w: 58, h: -11 }, { x: 115, y: 677, w: 180, h: -11 }, { x: 296, y: 677, w: 66, h: -11 }, { x: 362, y: 677, w: 66, h: -11 }, { x: 428, y: 677, w: 80, h: -11 }],
  };
  const r = parseTableStatement([page]);
  assert.deepEqual(r, [{ date: '2026-10-18', label: 'Coop Lugano', amount: -33 }, { date: '2026-10-19', label: 'Accredito Acme SA', amount: 4200.5 }]);
  assert.deepEqual(parseTableStatement([{ runs: [{ x: 1, y: 1, text: 'niente' }], rects: [] }]), []);
});
