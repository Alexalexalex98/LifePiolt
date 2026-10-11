// node --experimental-strip-types --test tests/bills.test.mjs
// Analisi locale di bollette e fatture (it, de, fr, en): campi, confidenze, controlli IBAN/QRR/SCOR, date ambigue.
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseBillText, parseAmount } from '../src/lib/bills/parse.ts';
import { checkIban, checkPagoPa, checkQrr, checkScor, mod10Check } from '../src/lib/bills/checks.ts';
import { draftFromText, looksLikeBill, applyAiExtraction } from '../src/lib/bills/index.ts';
import { formFromDraft, validateForm, inputToIso, inputToAmount, isoToInput } from '../src/lib/bills/form.ts';

const TODAY = '2026-10-11';
const P = (text, o = {}) => parseBillText(text, { today: TODAY, ...o });
const v = (f) => f?.value;

// ---------------------------------------------------------------- controlli algoritmici
test('IBAN: mod-97, paese, QR-IBAN', () => {
  assert.equal(checkIban('CH93 0076 2011 6238 5295 7').valid, true);
  assert.equal(checkIban('CH93 0076 2011 6238 5295 8').valid, false);
  assert.equal(checkIban('CH4431999123000889012').qrIban, true);
  assert.equal(checkIban('CH9300762011623852957').qrIban, false);
  assert.equal(checkIban('IT60 X054 2811 1010 0000 0123 456').valid, true);
  assert.equal(checkIban('DE89 3704 0044 0532 0130 00').valid, true);
  assert.equal(checkIban('FR14 2004 1010 0505 0001 3M02 606').valid, true);
  assert.equal(checkIban('IT60 X054 2811 1010 0000 0123 45').lengthOk, false);
  assert.equal(checkIban('1234'), null);
});
test('QRR: cifra di controllo modulo 10 ricorsivo', () => {
  assert.equal(checkQrr('21 00000 00003 13947 14300 09017').valid, true);
  assert.equal(checkQrr('21 00000 00003 13947 14300 09018').valid, false);
  assert.equal(checkQrr('1234'), null);
  assert.equal(mod10Check('21000000000313947143000901'), 7);
});
test('SCOR ISO 11649 e codice avviso PagoPA', () => {
  assert.equal(checkScor('RF18 5390 0754 7034').valid, true);
  assert.equal(checkScor('RF19 5390 0754 7034').valid, false);
  assert.equal(checkPagoPa('3010 0000 0000 0000 00').valid, true);
  assert.equal(checkPagoPa('9010 0000 0000 0000 00').valid, false);
  assert.equal(checkPagoPa('301000'), null);
});
test('parseAmount: formati e separatori', () => {
  assert.deepEqual(parseAmount('1.234,56'), { value: 1234.56, ambiguous: false });
  assert.deepEqual(parseAmount("1'234.56"), { value: 1234.56, ambiguous: false });
  assert.deepEqual(parseAmount('1,234.56'), { value: 1234.56, ambiguous: false });
  assert.deepEqual(parseAmount('84,50'), { value: 84.5, ambiguous: false });
  assert.deepEqual(parseAmount('84.50'), { value: 84.5, ambiguous: false });
  assert.deepEqual(parseAmount('1.234'), { value: 1234, ambiguous: true });
  assert.deepEqual(parseAmount('12.345.678'), { value: 12345678, ambiguous: false });
  assert.deepEqual(parseAmount('84.-'), { value: 84, ambiguous: false });
  assert.equal(parseAmount('abc'), null);
});

// ---------------------------------------------------------------- 1. QR-bill svizzera (de)
const CH_STROM = `ACME Energie AG
Musterstrasse 12
8000 Zürich
Rechnung Nr. 2026-10442
Rechnungsdatum: 05.10.2026
Abrechnungsperiode: 01.07.2026 - 30.09.2026
Stromverbrauch 812 kWh
Netto 78.20
MWST 8.1% 6.33
Total zu zahlen CHF 84.53
Zahlbar bis 04.11.2026
Zahlteil
Konto / Zahlbar an
CH44 3199 9123 0008 8901 2
ACME Energie AG
Referenz
21 00000 00003 13947 14300 09017
Währung Betrag
CHF 84.53`;
test('01 QR-bill svizzera di luce (de): importo, scadenza, QR-IBAN, QRR valido', () => {
  const d = P(CH_STROM);
  assert.equal(d.lang, 'de');
  assert.equal(v(d.issuer), 'ACME Energie AG');
  assert.equal(v(d.kind), 'luce');
  assert.equal(v(d.amount), 84.53); assert.equal(d.amount.confidence, 'alta');
  assert.equal(v(d.currency), 'CHF');
  assert.equal(v(d.dueDate), '2026-11-04'); assert.equal(d.dueDate.confidence, 'alta');
  assert.equal(v(d.issueDate), '2026-10-05');
  assert.equal(v(d.periodFrom), '2026-07-01'); assert.equal(v(d.periodTo), '2026-09-30');
  assert.equal(v(d.number), '2026-10442');
  assert.equal(v(d.iban), 'CH44 3199 9123 0008 8901 2'); assert.equal(d.iban.confidence, 'alta');
  assert.equal(d.qrIban, true);
  assert.equal(d.referenceType, 'QRR'); assert.equal(v(d.reference), '21 00000 00003 13947 14300 09017'); assert.equal(d.reference.confidence, 'alta');
  assert.equal(v(d.recurrence), 'quarterly');
  assert.ok(d.amount.source.includes('84.53'));
  assert.equal(d.amount.match, 'CHF 84.53');
});

// ---------------------------------------------------------------- 2. IT luce con PagoPA
const IT_LUCE = `ENEL ENERGIA S.p.A.
Bolletta luce n. 2026/884412 del 10/10/2026
Periodo di fatturazione: dal 01/08/2026 al 30/09/2026
Consumo fatturato: 245 kWh
Imponibile 52,10
IVA 10% 5,21
Totale da pagare € 57,31
Scadenza: 30/10/2026
Codice POD IT001E12345678
Avviso PagoPA - Codice avviso 3010 0000 0000 0000 00
In caso di ritardo interessi di mora al 3,5% annuo`;
test('02 bolletta luce italiana con codice avviso PagoPA', () => {
  const d = P(IT_LUCE);
  assert.equal(d.lang, 'it');
  assert.equal(v(d.issuer), 'Enel');
  assert.equal(v(d.kind), 'luce');
  assert.equal(v(d.amount), 57.31); assert.equal(v(d.currency), 'EUR');
  assert.equal(v(d.dueDate), '2026-10-30'); assert.equal(v(d.issueDate), '2026-10-10');
  assert.equal(v(d.number), '2026/884412');
  assert.equal(v(d.pagopa), '3010 0000 0000 0000 00');
  assert.equal(v(d.lateInterestPct), 3.5);
  assert.equal(v(d.recurrence), 'bimonthly');
  assert.equal(d.reminderNotice, undefined);
});

// ---------------------------------------------------------------- 3. IT gas con scadenza testuale
test('03 gas: "entro il 30 novembre 2026" e importi con IVA', () => {
  const d = P(`Eni Plenitude S.p.A. Società Benefit
Fattura gas n. 7700123456
Data emissione 12/10/2026
Consumo 118 Smc
Totale imponibile € 140,00
IVA 22% € 30,80
Totale fattura € 170,80
Importo da pagare entro il 30 novembre 2026: € 170,80`);
  assert.equal(v(d.kind), 'gas');
  assert.equal(v(d.amount), 170.8); assert.equal(d.amount.confidence, 'alta');
  assert.equal(v(d.dueDate), '2026-11-30');
  assert.equal(v(d.issueDate), '2026-10-12');
});

// ---------------------------------------------------------------- 4. acqua
test('04 acqua italiana con importi multipli: sceglie il totale da pagare', () => {
  const d = P(`Acquedotto Comunale
Servizio idrico integrato
Fattura n. 55/2026 del 02/10/2026
Quota fissa 12,00
Consumo 38 mc  € 41,20
Depurazione € 18,30
IVA 10% € 7,15
Totale da pagare € 78,65
Scadenza 02/11/2026`);
  assert.equal(v(d.kind), 'acqua');
  assert.equal(v(d.amount), 78.65);
  assert.equal(v(d.dueDate), '2026-11-02');
});

// ---------------------------------------------------------------- 5. fr
test('05 facture suisse romande (fr): montant à payer et échéance', () => {
  const d = P(`Swisscom (Suisse) SA
Facture n° 1234567890
Date de facture 02.10.2026
Abonnement Internet + TV    CHF 79.00
Montant à payer CHF 79.00
Échéance 15.11.2026
Veuillez payer jusqu'au 15.11.2026`);
  assert.equal(d.lang, 'fr');
  assert.equal(v(d.issuer), 'Swisscom');
  assert.equal(v(d.kind), 'internet');
  assert.equal(v(d.amount), 79); assert.equal(v(d.currency), 'CHF');
  assert.equal(v(d.dueDate), '2026-11-15');
  assert.equal(v(d.issueDate), '2026-10-02');
  assert.equal(v(d.number), '1234567890');
});

// ---------------------------------------------------------------- 6/7. en e date ambigue
test('06 fattura inglese: 11/30/2026 e\' mm/gg (30 > 12), importo 1,234.56', () => {
  const d = P(`Globex Ltd.
Invoice No. INV-2026-0099
Invoice date: 10/15/2026
Amount due: $1,234.56
Due date: 11/30/2026`);
  assert.equal(d.lang, 'en');
  assert.equal(v(d.amount), 1234.56); assert.equal(v(d.currency), 'USD');
  assert.equal(v(d.dueDate), '2026-11-30');
  assert.equal(v(d.issueDate), '2026-10-15');
  assert.equal(d.ambiguities.length, 0);
  assert.equal(v(d.number), 'INV-2026-0099');
});
test('07 data ambigua gg/mm vs mm/gg in un documento inglese: segnalata, confidenza media', () => {
  const d = P(`Initech Ltd
Invoice 4471
Total due: GBP 220.00
Due date: 03/04/2026`, { today: '2026-01-10' });
  assert.equal(v(d.dueDate), '2026-04-03');
  assert.equal(d.dueDate.confidence, 'media');
  assert.ok(d.ambiguities.length >= 1);
  assert.ok(d.dueDate.note.includes('2026-03-04'));
});
test('07b ordine mm/gg dichiarato dal locale dell\'utente', () => {
  const d = P('Pay by 03/04/2026\nTotal due $50.00 USD\nAcme Inc invoice', { dateOrder: 'mdy', today: '2026-01-10' });
  assert.equal(v(d.dueDate), '2026-03-04');
  assert.ok(d.ambiguities.length >= 1);
});
test('07c in un documento italiano 03/04/2026 e\' gg/mm senza ambiguita\'', () => {
  const d = P('Fattura n. 12\nScadenza 03/04/2026\nTotale da pagare € 50,00');
  assert.equal(v(d.dueDate), '2026-04-03');
  assert.equal(d.ambiguities.length, 0);
});

// ---------------------------------------------------------------- 8. B2B DE con MWST
test('08 fattura B2B svizzera con MWST/UID e scadenza relativa a 30 giorni', () => {
  const d = P(`Muster Consulting GmbH
CHE-123.456.789 MWST
Rechnung Nr. R-2026-118
Rechnungsdatum: 01.10.2026
Beratung Oktober     CHF 2'400.00
MWST 8.1%            CHF 194.40
Rechnungsbetrag inkl. MWST  CHF 2'594.40
Zahlbar innert 30 Tagen netto
IBAN CH93 0076 2011 6238 5295 7`);
  assert.equal(v(d.amount), 2594.4);
  assert.equal(v(d.taxId).startsWith('CHE-123.456.789'), true);
  assert.equal(v(d.dueDate), '2026-10-31');
  assert.equal(d.dueDate.confidence, 'media');
  assert.ok(d.dueDate.note);
  assert.equal(v(d.iban), 'CH93 0076 2011 6238 5295 7');
  assert.equal(d.qrIban, undefined);
  assert.equal(v(d.number), 'R-2026-118');
});

// ---------------------------------------------------------------- 9. IT fattura B2B
test('09 fattura B2B italiana: P.IVA, 30 gg data fattura, IBAN italiano', () => {
  const d = P(`Rossi Servizi S.r.l.
P.IVA 01234567890
FATTURA N. 45/2026 del 03/10/2026
Consulenza informatica       € 1.000,00
IVA 22%                      € 220,00
TOTALE FATTURA               € 1.220,00
Pagamento: bonifico a 30 gg data fattura
IBAN: IT60 X054 2811 1010 0000 0123 456`);
  assert.equal(v(d.issuer), 'Rossi Servizi S.r.l.');
  assert.equal(v(d.amount), 1220);
  assert.equal(v(d.taxId), '01234567890');
  assert.equal(v(d.issueDate), '2026-10-03');
  assert.equal(v(d.dueDate), '2026-11-02');
  assert.equal(v(d.iban), 'IT60 X054 2811 1010 0000 0123 456');
});

// ---------------------------------------------------------------- 10. affitto
test('10 affitto mensile', () => {
  const d = P(`Immobiliare Bianchi Sagl
Canone di locazione novembre 2026
Importo canone € 950,00
Spese condominiali € 120,00
Totale da pagare € 1.070,00
Scadenza: 05/11/2026
Bonifico su IBAN IT60X0542811101000000123456 intestato a Immobiliare Bianchi Sagl
Pagamento mensile`);
  assert.equal(v(d.kind), 'affitto');
  assert.equal(v(d.amount), 1070);
  assert.equal(v(d.dueDate), '2026-11-05');
  assert.equal(v(d.iban), 'IT60 X054 2811 1010 0000 0123 456');
  assert.equal(v(d.recurrence), 'monthly');
});

// ---------------------------------------------------------------- 11. assicurazione malattia
test('11 cassa malati: Prämienrechnung', () => {
  const d = P(`Helsana Versicherungen AG
Prämienrechnung November 2026
Grundversicherung      CHF 312.40
Zusatzversicherung     CHF 72.60
Total zu zahlen        CHF 385.00
Zahlbar bis 30.11.2026`);
  assert.equal(v(d.issuer), 'Helsana');
  assert.equal(v(d.kind), 'assicurazione');
  assert.equal(v(d.amount), 385);
  assert.equal(v(d.dueDate), '2026-11-30');
});

// ---------------------------------------------------------------- 12-14 solleciti
test('12 sollecito italiano: spese di sollecito, interessi di mora, livello', () => {
  const d = P(`SOLLECITO DI PAGAMENTO
A2A Energia S.p.A.
Dalla nostra verifica la fattura n. 7788/2026 risulta non pagata.
Importo fattura € 84,50
Spese di sollecito € 5,00
Interessi di mora al 4,2% annuo
Totale da pagare subito € 89,50
Scadenza: 18/10/2026`);
  assert.equal(v(d.reminderNotice), 1); assert.equal(d.reminderNotice.confidence, 'alta');
  assert.equal(v(d.lateFee), 5);
  assert.equal(v(d.lateInterestPct), 4.2);
  assert.equal(v(d.amount), 89.5);
  assert.ok(d.warnings.some((w) => /sollecito/i.test(w)));
});
test('13 Mahnung tedesca (2. Mahnung) con Mahngebühr', () => {
  const d = P(`Sunrise Communications AG
2. Mahnung
Rechnung 88221 vom 01.09.2026 ist noch offen.
Mahngebühr CHF 20.00
Total zu zahlen CHF 119.00
Zahlbar bis 20.10.2026`);
  assert.equal(v(d.reminderNotice), 2);
  assert.equal(v(d.lateFee), 20);
  assert.equal(v(d.amount), 119);
  assert.equal(v(d.dueDate), '2026-10-20');
});
test('14 dernier rappel francese: livello 3 e frais con formato "30.-"', () => {
  const d = P(`Dernier rappel
Groupe E SA
Facture n° 99120 du 02.09.2026
Frais de rappel CHF 30.-
Montant à payer CHF 210.50
Échéance 14.10.2026`);
  assert.equal(v(d.reminderNotice), 3);
  assert.equal(v(d.lateFee), 30);
  assert.equal(v(d.amount), 210.5);
});
test('14b clausola condizionale "in caso di ritardo" non e\' un sollecito', () => {
  const d = P('Fattura n. 9\nTotale da pagare € 40,00\nScadenza 30/11/2026\nIn caso di ritardo verranno applicate spese di sollecito e interessi di mora, come da contratto di fornitura.');
  assert.equal(d.reminderNotice, undefined);
});

// ---------------------------------------------------------------- 15-17 altri tipi
test('15 tasse: IMU con F24', () => {
  const d = P(`Comune di Lugano - Ufficio tributi
IMU 2026 saldo
Importo da versare con F24: € 410,00
Scadenza versamento: 16/12/2026`);
  assert.equal(v(d.kind), 'tasse');
  assert.equal(v(d.amount), 410);
  assert.equal(v(d.dueDate), '2026-12-16');
});
test('16 fattura medica', () => {
  const d = P(`Praxis Dr. med. Keller
Arztrechnung Nr. 2026-3321
Konsultation Tarmed  CHF 215.40
Total CHF 215.40
Zahlbar innert 30 Tagen
Rechnungsdatum 08.10.2026`);
  assert.equal(v(d.kind), 'medico');
  assert.equal(v(d.amount), 215.4);
  assert.equal(v(d.dueDate), '2026-11-07');
});
test('17 abbonamento in inglese (nessuna scadenza esplicita)', () => {
  const d = P(`Netflix
Your subscription will renew. Amount: $15.99 per month.
Next billing date: 25 October 2026`);
  assert.equal(v(d.kind), 'abbonamento');
  assert.equal(v(d.amount), 15.99);
  assert.ok(d.warnings.some((w) => /scadenza/i.test(w)) || d.dueDate);
});

// ---------------------------------------------------------------- 18-22 importi ambigui e formati
test('18 importo con un solo punto e tre cifre: ambiguo (1.234 = 1234?)', () => {
  const d = P('Fattura n. 3\nTotale da pagare 1.234\nScadenza 30/11/2026');
  assert.equal(v(d.amount), 1234);
  assert.notEqual(d.amount.confidence, 'alta');
  assert.ok(d.ambiguities.length >= 1);
});
test('19 formato svizzero 1\'234.50 con CHF dopo', () => {
  const d = P("Rechnung 1\nGesamtbetrag 1'234.50 CHF\nFällig am 15.12.2026");
  assert.equal(v(d.amount), 1234.5); assert.equal(v(d.currency), 'CHF');
  assert.equal(v(d.dueDate), '2026-12-15');
});
test('20 spazio come separatore delle migliaia e Fr.', () => {
  const d = P('Rechnung 7\nTotal zu zahlen Fr. 12 345.60\nZahlbar bis 31.12.2026');
  assert.equal(v(d.amount), 12345.6); assert.equal(v(d.currency), 'CHF');
});
test('21 importo del totale su riga separata dall\'etichetta (layout a tabella)', () => {
  const d = P('Fattura 22\nTotale da pagare\n€ 99,90\nScadenza\n20/11/2026');
  assert.equal(v(d.amount), 99.9);
  assert.equal(v(d.dueDate), '2026-11-20');
});
test('22 due importi "totale": prima e dopo la scadenza -> ambiguita\' segnalata', () => {
  const d = P('Fattura n. 5\nTotale da pagare entro la scadenza € 84,50\nTotale da pagare dopo la scadenza € 90,00\nScadenza 30/11/2026');
  assert.ok([84.5, 90].includes(v(d.amount)));
  assert.notEqual(d.amount.confidence, 'alta');
  assert.ok(d.ambiguities.length >= 1);
  assert.ok(d.amountAlternatives.length >= 2);
});

// ---------------------------------------------------------------- 23-27 date
test('23 data a due cifre 30.11.26 e anno corto', () => {
  const d = P('Rechnung 1\nTotal zu zahlen CHF 10.00\nZahlbar bis 30.11.26');
  assert.equal(v(d.dueDate), '2026-11-30');
});
test('24 "Payable by 30th November 2026"', () => {
  const d = P('Invoice 12\nTotal due £45.00\nPayable by 30th November 2026');
  assert.equal(v(d.dueDate), '2026-11-30'); assert.equal(v(d.currency), 'GBP');
});
test('25 "zahlbar bis 30. November 2026" e mese francese "30 novembre 2026"', () => {
  assert.equal(v(P('Rechnung\nTotal zu zahlen CHF 10.00\nzahlbar bis 30. November 2026').dueDate), '2026-11-30');
  assert.equal(v(P('Facture\nMontant à payer CHF 10.00\nÉchéance : 30 novembre 2026').dueDate), '2026-11-30');
  assert.equal(v(P('Fattura\nTotale da pagare € 10,00\nscadenza: 30 novembre 2026').dueDate), '2026-11-30');
  assert.equal(v(P('Invoice\nAmount due €10.00\nDue on Nov 30, 2026').dueDate), '2026-11-30');
});
test('26 anno mancante: "entro il 30 novembre" prende il prossimo 30 novembre', () => {
  const d = P('Fattura 3\nTotale da pagare € 20,00\nDa pagare entro il 30 novembre');
  assert.equal(v(d.dueDate), '2026-11-30');
  const d2 = P('Fattura 3\nTotale da pagare € 20,00\nDa pagare entro il 5 gennaio', { today: '2026-12-20' });
  assert.equal(v(d2.dueDate), '2027-01-05');
});
test('27 le date del periodo non sono la scadenza', () => {
  const d = P('Fornitura\nPeriodo: dal 01/09/2026 al 30/09/2026\nTotale da pagare € 30,00');
  assert.equal(d.dueDate, undefined);
  assert.ok(d.warnings.some((w) => /scadenza/i.test(w)));
  assert.equal(v(d.periodFrom), '2026-09-01'); assert.equal(v(d.periodTo), '2026-09-30');
});

// ---------------------------------------------------------------- 28-32 identificativi, QR, errori
test('28 contenuto del codice QR svizzero (SPC) incollato', () => {
  const spc = ['SPC', '0200', '1', 'CH4431999123000889012', 'S', 'Robert Schneider AG', 'Rue du Lac', '1268', '2501', 'Biel', 'CH', '', '', '', '', '', '', '', '3949.75', 'CHF', 'S', 'Pia-Maria Rubin', 'Chemin des Fleurs', '28', '1000', 'Lausanne', 'CH', 'QRR', '210000000003139471430009017', 'Rechnung Nr. 3139 für Gartenarbeiten', 'EPD'].join('\n');
  const d = P(spc);
  assert.equal(v(d.amount), 3949.75); assert.equal(v(d.currency), 'CHF');
  assert.equal(v(d.issuer), 'Robert Schneider AG');
  assert.equal(d.referenceType, 'QRR'); assert.equal(d.reference.confidence, 'alta');
  assert.equal(d.qrIban, true);
});
test('29 IBAN con una cifra sbagliata: letto ma con confidenza bassa e avviso', () => {
  const d = P('Fattura 1\nTotale da pagare € 10,00\nScadenza 30/11/2026\nIBAN IT60 X054 2811 1010 0000 0123 457');
  assert.equal(d.iban.confidence, 'bassa');
  assert.ok(d.warnings.some((w) => /IBAN/.test(w)));
});
test('30 riferimento QR con cifra di controllo errata: avviso', () => {
  const d = P('Rechnung 1\nTotal zu zahlen CHF 10.00\nZahlbar bis 30.11.2026\nReferenz\n21 00000 00003 13947 14300 09018');
  assert.equal(d.reference.confidence, 'bassa');
  assert.ok(d.warnings.some((w) => /modulo 10/.test(w)));
});
test('31 QR-IBAN senza riferimento QR: avviso', () => {
  const d = P('Rechnung 1\nTotal zu zahlen CHF 10.00\nZahlbar bis 30.11.2026\nKonto / Zahlbar an\nCH44 3199 9123 0008 8901 2\nFirma AG');
  assert.equal(d.qrIban, true);
  assert.ok(d.warnings.some((w) => /QR-IBAN/.test(w)));
});
test('32 riferimento SCOR (RF) valido', () => {
  const d = P('Rechnung 1\nTotal zu zahlen CHF 10.00\nZahlbar bis 30.11.2026\nReferenz RF18 5390 0754 7034\nIBAN CH93 0076 2011 6238 5295 7');
  assert.equal(d.referenceType, 'SCOR'); assert.equal(v(d.reference), 'RF18539007547034');
});

// ---------------------------------------------------------------- 33-36 robustezza
test('33 testo senza senso: bozza vuota e nessuna invenzione', () => {
  const d = P('ciao come stai? domani andiamo al mare con Luca');
  assert.equal(d.empty, true);
  assert.equal(d.amount, undefined); assert.equal(d.dueDate, undefined); assert.equal(d.iban, undefined);
  assert.equal(v(d.kind), 'altro');
});
test('34 testo vuoto, spazi, e input non stringa non lanciano', () => {
  for (const x of ['', '   \n\n', null, undefined]) assert.doesNotThrow(() => P(x));
  assert.equal(P('').empty, true);
});
test('35 scadenza passata: avviso di ritardo; scadenza molto lontana: avviso', () => {
  assert.ok(P('Fattura 1\nTotale da pagare € 10,00\nScadenza 01/09/2026').warnings.some((w) => /passata|ritardo/.test(w)));
  assert.ok(P('Fattura 1\nTotale da pagare € 10,00\nScadenza 01/09/2029').warnings.some((w) => /anno/.test(w)));
});
test('36 scadenza prima della data di emissione: avviso', () => {
  const d = P('Fattura n. 1 del 20/11/2026\nTotale da pagare € 10,00\nScadenza 05/11/2026');
  assert.ok(d.warnings.some((w) => /prima della data/.test(w)));
});
test('37 numeri di telefono, CAP e codici non diventano importi', () => {
  const d = P('Telecom Italia\nTel. 800 123456 - CAP 20100\nCodice cliente 1234567890\nTotale da pagare € 29,99\nScadenza 20/11/2026');
  assert.equal(v(d.amount), 29.99);
});
test('38 valuta di riserva dell\'app quando il documento non la indica', () => {
  const d = P('Fattura 1\nTotale da pagare 45,00\nScadenza 30/11/2026', { defaultCurrency: 'CHF' });
  assert.equal(v(d.amount), 45); assert.equal(v(d.currency), 'CHF'); assert.equal(d.currency.confidence, 'bassa');
});
test('39 ogni campo letto ha riga di origine e confidenza', () => {
  const d = P(CH_STROM);
  for (const k of ['issuer', 'kind', 'amount', 'currency', 'issueDate', 'dueDate', 'number', 'iban', 'reference']) {
    assert.ok(d[k], k);
    assert.ok(['alta', 'media', 'bassa'].includes(d[k].confidence), k);
    assert.equal(typeof d[k].source, 'string', k);
  }
});
test('40 lingue miste e maiuscole: FATTURA / TOTALE DA PAGARE', () => {
  const d = P('VODAFONE ITALIA S.P.A.\nFATTURA N. AB22-123456\nTOTALE DA PAGARE EUR 29,99\nSCADENZA 20/10/2026');
  assert.equal(v(d.issuer), 'Vodafone');
  assert.equal(v(d.amount), 29.99); assert.equal(v(d.currency), 'EUR');
  assert.equal(v(d.dueDate), '2026-10-20');
  assert.equal(v(d.number), 'AB22-123456');
  assert.equal(v(d.kind), 'internet');
});

// ---------------------------------------------------------------- riconoscimento, adattatore AI, modulo
test('looksLikeBill: dal nome o dal testo', () => {
  assert.equal(looksLikeBill('Fattura_ottobre.pdf'), true);
  assert.equal(looksLikeBill('Rechnung 2026.pdf'), true);
  assert.equal(looksLikeBill('vacanze.jpg'), false);
  assert.equal(looksLikeBill('scan.pdf', CH_STROM), true);
  assert.equal(looksLikeBill('note.txt', 'comprare latte e pane domani'), false);
  assert.equal(looksLikeBill('', undefined), false);
});
test('draftFromText e\' parseBillText', () => {
  assert.deepEqual(draftFromText(IT_LUCE, { today: TODAY }), P(IT_LUCE));
});
test('applyAiExtraction: non sovrascrive cio\' che e\' gia\' alto; riempie i campi mancanti con confidenza media', () => {
  const base = P('Fattura 1\nTotale da pagare € 10,00');
  assert.equal(base.dueDate, undefined);
  const out = applyAiExtraction(base, { fields: { dueDate: '2026-11-30', amount: 999, issuer: 'Acme SA', kind: 'luce' } });
  assert.equal(v(out.dueDate), '2026-11-30'); assert.equal(out.dueDate.confidence, 'media');
  assert.equal(v(out.amount), 10);
  assert.equal(v(out.issuer), 'Acme SA');
  assert.equal(v(out.kind), 'luce');
  const fromText = applyAiExtraction(P('niente'), { text: CH_STROM }, { today: TODAY });
  assert.equal(v(fromText.amount), 84.53);
  assert.ok(fromText.amount.note);
});
test('form: da bozza a modulo e validazione', () => {
  const f = formFromDraft(P(CH_STROM));
  assert.equal(f.amount, '84,53'); assert.equal(f.dueDate, '04/11/2026'); assert.equal(f.currency, 'CHF');
  const r = validateForm(f);
  assert.equal(r.ok, true);
  assert.equal(r.value.amount, 84.53); assert.equal(r.value.dueDate, '2026-11-04'); assert.equal(r.value.iban, 'CH44 3199 9123 0008 8901 2');
  const bad = validateForm({ ...f, amount: '', dueDate: '31/02/2026', issuer: '' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.amount && bad.errors.dueDate && bad.errors.issuer);
  assert.equal(inputToIso('5.11.26'), '2026-11-05');
  assert.equal(inputToIso('2026-11-05'), '2026-11-05');
  assert.equal(inputToIso('32/01/2026'), null);
  assert.equal(inputToAmount('CHF 1.234,50'), 1234.5);
  assert.equal(inputToAmount('0'), null);
  assert.equal(isoToInput('2026-01-05'), '05/01/2026');
});
