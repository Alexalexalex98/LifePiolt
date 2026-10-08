import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseDate, detectDelimiter, parseCsv, splitDuplicates, movementLabel, decodeBytes, categorize } from '../src/lib/csvImport.ts';

const CATS = ['Affitto', 'Fondo emergenza', 'Alimentari/Casa', 'Cassa malati', 'Abbigliamento', 'Viaggio estero', 'Abbonamenti', 'Altro'];

test('parseAmount: formati svizzeri e internazionali', () => {
  assert.equal(parseAmount("1'234.50"), 1234.5);
  assert.equal(parseAmount('1’234,50'), 1234.5);
  assert.equal(parseAmount('-45,90'), -45.9);
  assert.equal(parseAmount('45.90-'), -45.9);
  assert.equal(parseAmount('CHF 12.50'), 12.5);
  assert.equal(parseAmount('(12.50)'), -12.5);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount("-2'500.00"), -2500);
  assert.equal(parseAmount('1.234'), 1234);
  assert.equal(parseAmount('0,5'), 0.5);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
});
test('parseDate: dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd, non valide', () => {
  assert.equal(parseDate('05.10.2026'), '2026-10-05');
  assert.equal(parseDate('5/10/2026'), '2026-10-05');
  assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate('2026-10-05 14:30:00'), '2026-10-05');
  assert.equal(parseDate('05.10.26'), '2026-10-05');
  assert.equal(parseDate('31.02.2026'), null);
  assert.equal(parseDate('ciao'), null);
});
test('detectDelimiter', () => {
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
});

const UBS = `Numero di conto:;0230 00000000.40
Da:;2026-09-01
Data operazione;Ora;Data contabile;Valuta;Moneta;Addebito;Accredito;Importo singolo;Saldo;N. di transazione;Descrizione1;Descrizione2;Descrizione3;Note a piè di pagina
2026-10-02;;2026-10-02;2026-10-02;CHF;1'400.00;;;5'120.30;9930;Ordine di pagamento;Affitto ottobre;Immobiliare Rossi SA;
2026-10-03;;2026-10-03;2026-10-03;CHF;87.45;;;5'032.85;9931;Pagamento carta di debito;Migros Lugano Centro;;
2026-10-05;;2026-10-05;2026-10-05;CHF;15.90;;;5'016.95;9932;Pagamento carta di debito;NETFLIX.COM;;
2026-10-25;;2026-10-25;2026-10-25;CHF;;6'500.00;;11'516.95;9933;Accredito;Stipendio Life SA;;
`;
test('UBS: intestazioni dopo righe di preambolo, dare/avere, apice svizzero', () => {
  const r = parseCsv(UBS, CATS);
  assert.equal(r.delimiter, ';');
  assert.equal(r.rows.length, 4);
  assert.deepEqual(r.rows.map((x) => x.amount), [-1400, -87.45, -15.9, 6500]);
  assert.deepEqual(r.rows.map((x) => x.category), ['Affitto', 'Alimentari/Casa', 'Abbonamenti', null]);
  assert.equal(r.rows[0].date, '2026-10-02');
  assert.match(r.rows[1].label, /Migros Lugano Centro/);
});

const POST = `Datum;Bewegungstyp;Avisierungstext;Gutschrift in CHF;Lastschrift in CHF;Label;Kategorie
03.10.2026;Zahlung;KAUF/DIENSTLEISTUNG VOM 02.10.2026 SBB MOBILE LUGANO;;-13,40;;
04.10.2026;Zahlung;KAUF TAMOIL TANKSTELLE;;-72,10;;
06.10.2026;Gutschrift;LOHN LIFE SA;6500,00;;;
07.10.2026;Zahlung;Helsana Krankenkasse Prämie;;-385,00;;
`;
test('PostFinance: virgola decimale, SBB e benzina, cassa malati', () => {
  const r = parseCsv(POST, CATS);
  assert.equal(r.rows.length, 4);
  assert.equal(r.rows[0].amount, -13.4);
  assert.equal(r.rows[1].amount, -72.1);
  assert.equal(r.rows[2].amount, 6500);
  assert.equal(r.rows[0].category, 'Abbonamenti');   // senza categoria 'Trasporti': ripiego sensato
  assert.equal(r.rows[1].category, 'Altro');
  assert.equal(r.rows[3].category, 'Cassa malati');
});
test('con una categoria Trasporti disponibile, SBB e benzina ci vanno', () => {
  const r = parseCsv(POST, [...CATS, 'Trasporti']);
  assert.equal(r.rows[0].category, 'Trasporti'); assert.equal(r.rows[1].category, 'Trasporti');
});

const GEN = `Data,Descrizione,Importo
05/10/2026,"Coop, Bellinzona",-54.30
06/10/2026,Spotify,-12.95
07/10/2026,Rimborso,20.00
riga rotta,,
`;
test('CSV generico con virgole, virgolette e righe rotte', () => {
  const r = parseCsv(GEN, CATS);
  assert.equal(r.delimiter, ',');
  assert.equal(r.rows.length, 3); assert.equal(r.skipped, 1);
  assert.equal(r.rows[0].label, 'Coop, Bellinzona');
  assert.equal(r.rows[0].category, 'Alimentari/Casa');
  assert.equal(r.rows[1].category, 'Abbonamenti');
  assert.equal(r.rows[2].category, null);
});
test('senza intestazioni: colonne dedotte dal contenuto', () => {
  const r = parseCsv('05.10.2026;Migros;-23.40\n06.10.2026;Coop;-10.00\n07.10.2026;Stipendio;5000.00\n', CATS);
  assert.equal(r.rows.length, 3); assert.ok(r.warnings.length > 0);
  assert.equal(r.rows[2].amount, 5000);
});
test('file non CSV: errore chiaro, niente righe', () => {
  const r = parseCsv('ciao come stai\nnulla di utile', CATS);
  assert.equal(r.rows.length, 0); assert.ok(r.warnings.length > 0);
});
test('duplicati gia presenti ignorati, con conteggio', () => {
  const rows = parseCsv(UBS, CATS).rows;
  const existing = [{ monthLabel: 'Ottobre 2026', date: '03/10', amount: -87.45 }, { monthLabel: 'Ottobre 2026', date: '25/10', amount: 6500 }];
  const { fresh, duplicates } = splitDuplicates(rows, existing);
  assert.equal(duplicates.length, 2); assert.equal(fresh.length, 2);
  const twice = [rows[1], rows[1]];
  assert.equal(splitDuplicates(twice, [{ monthLabel: 'Ottobre 2026', date: '03/10', amount: -87.45 }]).fresh.length, 1);
  assert.equal(splitDuplicates(rows, rows.map((r) => ({ monthLabel: 'Ottobre 2026', date: r.date.slice(8) + '/' + r.date.slice(5, 7), amount: r.amount }))).fresh.length, 0);
});
test('movementLabel e decodifica Windows-1252', () => {
  assert.equal(movementLabel({ date: '2026-10-03', label: 'Migros', amount: -5, category: 'Alimentari/Casa' }), 'Alimentari/Casa · Migros');
  assert.equal(movementLabel({ date: '2026-10-03', label: 'Stipendio', amount: 5, category: null }), 'Stipendio');
  assert.equal(decodeBytes(new Uint8Array([0x43, 0x61, 0x66, 0xe9])), 'Café');
  assert.equal(decodeBytes(new TextEncoder().encode('Café')), 'Café');
  assert.equal(categorize('Qualcosa di strano', CATS), 'Altro');
});
