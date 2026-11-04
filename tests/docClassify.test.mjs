import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classify, parseAmount, totalOf, datesIn, KINDS } from '../src/lib/docClassify.ts';

test('importi all\'italiana, alla svizzera, all\'inglese', () => {
  assert.equal(parseAmount('1.234,50'), 1234.5); assert.equal(parseAmount("1'234.50"), 1234.5); assert.equal(parseAmount('1,234.50'), 1234.5);
  assert.equal(parseAmount('45,90'), 45.9); assert.equal(parseAmount('CHF 12.5'), 12.5); assert.equal(parseAmount('abc'), null);
});
test('date in più formati', () => {
  const d = datesIn('Scadenza 15/03/2026\nData 2 aprile 2026\nValida fino al 01.05.26').map((x) => x.iso);
  assert.deepEqual(d, ['2026-03-15', '2026-04-02', '2026-05-01']);
});
test('CV: nome dal file e dal testo, contatti, ruolo, esperienza', () => {
  const r = analyze('CV_Bianchi_Laura.pdf', 'Laura Bianchi\nGrafica\nlaura.bianchi@esempio.ch\n+41 79 123 45 67\nEsperienza lavorativa\n6 anni di esperienza come grafica. Lingue: italiano, inglese, tedesco');
  assert.equal(r.kind, 'cv'); assert.equal(r.fields.nome, 'Laura'); assert.equal(r.fields.cognome, 'Bianchi');
  assert.equal(r.fields.email, 'laura.bianchi@esempio.ch'); assert.match(r.fields.telefono, /\+41/); assert.equal(r.fields.ruolo, 'Grafica'); assert.equal(r.fields.esperienza, '6 anni'); assert.match(r.fields.lingue, /Tedesco/);
  assert.equal(KINDS[r.kind].section, 'Candidati');
});
test('CV senza testo: solo il nome del file', () => {
  const r = analyze('Curriculum_Mario_Rossi.pdf', '');
  assert.equal(r.kind, 'cv'); assert.equal(r.fields.cognome, 'Rossi');
});
test('fattura italiana: numero, fornitore, totale, scadenza, IBAN', () => {
  const r = analyze('fattura_2026_014.pdf', 'Rossi Impianti Srl\nP.IVA 01234567890\nFattura n. 2026/014 del 02/03/2026\nImponibile 1.000,00\nIVA 22% 220,00\nTotale documento € 1.220,00\nScadenza pagamento 30/03/2026\nIBAN IT60 X054 2811 1010 0000 0123 456');
  assert.equal(r.kind, 'invoice'); assert.equal(r.country, 'IT'); assert.equal(r.amount, 1220); assert.equal(r.currency, 'EUR'); assert.equal(r.due, '2026-03-30');
  assert.equal(r.fields.numero, '2026/014'); assert.match(r.fields.iban, /^IT60/); assert.equal(KINDS[r.kind].section, 'Pagamenti');
});
test('bolletta svizzera con QR: CHF e paese', () => {
  const r = analyze('bolletta.pdf', 'Servizi Industriali SA\nQR-fattura Zahlteil\nTotale CHF 184.30\nDa pagare entro il 20.11.2026\nIBAN CH93 0076 2011 6238 5295 7');
  assert.equal(r.kind, 'bill'); assert.equal(r.country, 'CH'); assert.equal(r.currency, 'CHF'); assert.equal(r.amount, 184.3); assert.equal(r.due, '2026-11-20');
});
test('busta paga e certificato di salario vanno alla persona', () => {
  const b = analyze('busta_paga_ottobre.pdf', 'Cedolino\nDipendente: Giulia Verdi\nOttobre 2026\nLordo 2.800,00\nNetto in busta 2.150,40');
  assert.equal(b.kind, 'payslip'); assert.equal(b.fields.periodo, 'Ottobre 2026'); assert.equal(b.fields.netto, '2150.4'); assert.equal(b.fields.lordo, '2800'); assert.equal(KINDS.payslip.access, 'person');
  const c = analyze('Lohnausweis_2025.pdf', 'Lohnausweis 2025\nAHV Beiträge\nNettolohn CHF 62\'400.00');
  assert.equal(c.kind, 'payslip'); assert.equal(c.tipo, 'Certificato di salario'); assert.equal(c.country, 'CH');
});
test('contratto: durata, scadenza, rinnovo; DURC e visura', () => {
  const k = analyze('contratto_locazione.pdf', 'Contratto di locazione\nTra le parti Immobiliare Verdi Srl e Rossi Srl\nDurata 12 mesi, con rinnovo tacito.\nScade il 31/12/2026');
  assert.equal(k.kind, 'contract'); assert.equal(k.fields.durata, '12 mesi'); assert.equal(k.fields.rinnovo, 'tacito'); assert.equal(k.due, '2026-12-31');
  assert.equal(analyze('DURC.pdf', 'Documento unico di regolarità contributiva').tipo, 'DURC');
  assert.equal(analyze('visura.pdf', 'Visura camerale\nCamera di Commercio').kind, 'registry');
});
test('preventivo, verbale e documento sconosciuto', () => {
  assert.equal(classify('preventivo_sito.pdf', 'Preventivo\nValida fino al 30/11/2026').kind, 'quote');
  assert.equal(classify('verbale.txt', 'Verbale riunione\nOrdine del giorno\nPresenti: A, B').kind, 'minutes');
  const o = classify('foto.pdf', 'ciao come stai oggi'); assert.equal(o.kind, 'other'); assert.ok(o.confidence < 0.5);
});
test('totale: ultimo importo della riga totale', () => {
  assert.equal(totalOf('Articolo 10,00\nTotale 10,00 + IVA 2,20 = 12,20'), 12.2);
});
