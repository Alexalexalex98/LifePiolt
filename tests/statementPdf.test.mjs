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

test('tabella con «Uscita CHF», «Entrata CHF», «Saldo CHF» e «Testo / Descrizione»: il saldo non è un importo', () => {
  const run = (x, y, text) => ({ x, y, text });
  const page = {
    runs: [run(40, 700, 'Data'), run(110, 700, 'Testo / Descrizione'), run(330, 700, 'Uscita CHF'), run(400, 700, 'Entrata CHF'), run(470, 700, 'Saldo CHF'),
      run(40, 686, '01.01.2026'), run(110, 686, 'Prelievo contanti ATM'), run(335, 686, '244.39'), run(470, 686, "4'605.61"),
      run(40, 672, '25.01.2026'), run(110, 672, 'Accredito salario mensile'), run(405, 672, "3'650.00"), run(470, 672, "6'619.92"),
      run(40, 658, '26.01.2026'), run(110, 658, 'Bonifico - affitto'), run(335, 658, "1'315.63"), run(470, 658, "5'304.29")],
    rects: [],
  };
  assert.deepEqual(parseTableStatement([page]), [
    { date: '2026-01-01', label: 'Prelievo contanti ATM', amount: -244.39 },
    { date: '2026-01-25', label: 'Accredito salario mensile', amount: 3650 },
    { date: '2026-01-26', label: 'Bonifico - affitto', amount: -1315.63 },
  ]);
});

test('una sola colonna importi con il saldo: il segno viene dalla variazione del saldo', () => {
  const run = (x, y, text) => ({ x, y, text });
  const page = {
    runs: [run(40, 700, 'Data'), run(110, 700, 'Descrizione'), run(330, 700, 'Importo'), run(420, 700, 'Saldo'),
      run(40, 686, '02.02.2026'), run(110, 686, 'Saldo precedente'), run(420, 686, '1000.00'),
      run(40, 672, '03.02.2026'), run(110, 672, 'Coop'), run(335, 672, '40.00'), run(420, 672, '960.00'),
      run(40, 658, '04.02.2026'), run(110, 658, 'Stipendio'), run(335, 658, '2000.00'), run(420, 658, '2960.00')],
    rects: [],
  };
  assert.deepEqual(parseTableStatement([page]), [
    { date: '2026-02-03', label: 'Coop', amount: -40 },
    { date: '2026-02-04', label: 'Stipendio', amount: 2000 },
  ]);
});

import fs from 'node:fs';
import { extractPdfLayout } from '../src/lib/bills/pdfText.ts';
test('estratto demo in PDF (tabella a strisce con importi a destra): 400 movimenti e saldo finale esatto', () => {
  const lay = extractPdfLayout(new Uint8Array(fs.readFileSync(new URL('../docs/demo/estratto_demo_400_movimenti.pdf', import.meta.url))));
  const mv = parseTableStatement(lay);
  assert.equal(mv.length, 400);
  const bal = mv.reduce((a, m) => a + m.amount, 6200);
  assert.equal(bal.toFixed(2), '5866.54');
  assert.ok(mv.some((m) => m.label.startsWith('Accredito salario') && m.amount === 4850));
  assert.ok(mv.some((m) => m.label === 'Affitto appartamento' && m.amount === -1450));
});

import { parseFlatStatement } from '../src/lib/statementPdf.ts';
const FLAT_CELLS = `FITTIZIO — SOLO TEST SOFTWARE
Pagina 1
BANCA DEMO
Estratto conto dettagliato  Conto privato demo  Valuta CHF
Intestatario
Cliente Demo
Numero conto
DEMO-2026-001
IBAN
CH00 0000 0000 0000 0000 0 (fittizio)
Periodo
01.01.2026 – 21.10.2026
Saldo iniziale
CHF 4'850.00
Data di riferimento
21.10.2026
 DOCUMENTO FITTIZIO — SOLO PER TEST SOFTWARE. Banca, intestatario, identificativi e movimenti sono inventati. Non è emesso da un istituto
 finanziario e non è valido come prova di reddito o di saldo.
Gennaio 2026
 Data
Testo / Descrizione
Uscita CHF
Entrata CHF
Saldo CHF
01.01.2026
Prelievo contanti ATM
244.39
4'605.61
01.01.2026
Pagamento bolletta elettricità
67.18
4'538.43
03.01.2026
Incasso TWINT / QR
76.49
4'614.92
03.01.2026
Pagamento carta - caffè e pasti
34.33
4'580.59
04.01.2026
Incasso TWINT / QR
134.69
4'715.28
05.01.2026
Rimborso acquisto
55.92
4'771.20
05.01.2026
Premio assicurazione
86.46
4'684.74
05.01.2026
Pagamento palestra
84.24
4'600.50
07.01.2026
Pagamento carburante
94.59
4'505.91
07.01.2026
Pagamento bolletta elettricità
61.00
4'444.91
07.01.2026
Versamento contanti
129.16
4'574.07
09.01.2026
Addebito telefonia e internet
91.64
4'482.43
09.01.2026
Pagamento carburante
81.20
4'401.23
10.01.2026
Addebito telefonia e internet
74.77
4'326.46
10.01.2026
Bonifico - affitto
1'315.63
3'010.83`;
test('testo semplice con ogni cella su una riga: date, descrizioni, importi e saldo', () => {
  const mv = parseFlatStatement(FLAT_CELLS);
  assert.ok(mv.length >= 14, String(mv.length));
  assert.deepEqual(mv[0], { date: '2026-01-01', label: 'Prelievo contanti ATM', amount: -244.39 });
  assert.deepEqual(mv[2], { date: '2026-01-03', label: 'Incasso TWINT / QR', amount: 76.49 });
  assert.ok(mv.every((m) => !/pagina|fittizio/i.test(m.label)));
});
test('testo semplice a una riga per movimento, senza saldo', () => {
  const t = '05.03.2026 Coop Lugano 45.90\n06.03.2026 Accredito stipendio Acme SA 4\'200.00\n07.03.2026 Swisscom fattura 49.00\n08.03.2026 Rimborso spese 12.50';
  const mv = parseFlatStatement(t);
  assert.deepEqual(mv.map((m) => m.amount), [-45.9, 4200, -49, 12.5]);
  assert.deepEqual(parseFlatStatement('niente da vedere qui'), []);
});
