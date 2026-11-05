import test from 'node:test';
import assert from 'node:assert/strict';
import { readContract, contractDeadlines, contractState, dueRows, OBLIGATIONS, fillLetter, LETTERS, missingFields, keepUntil, retentionDue, addMonths, datesOf } from '../src/lib/workLegal.ts';

const TXT = `CONTRATTO DI FORNITURA
Decorrenza dal 01/03/2026. Durata di 12 mesi, con rinnovo tacito di anno in anno salvo disdetta con preavviso di 60 giorni.
Il corrispettivo è di 4.800,00 euro, pagabile entro 90 giorni dalla fattura.
In caso di ritardo è dovuta una penale di 500 euro. Il cliente riconosce l'esclusiva al fornitore. Foro competente: Milano.`;
test('contratto: date, preavviso, rinnovo, penali', () => {
  const c = readContract('forn.pdf', TXT, '2026-06-01');
  assert.equal(c.start, '2026-03-01'); assert.equal(c.end, '2027-03-01'); assert.equal(c.months, 12);
  assert.equal(c.autoRenew, true); assert.equal(c.noticeDays, 60); assert.equal(c.cancelBy, '2026-12-31');
  assert.equal(c.paymentDays, 90); assert.equal(c.amount, 4800); assert.ok(c.penalties.length >= 1);
  assert.ok(c.clauses.includes('Esclusiva') && c.clauses.includes('Foro competente'));
  assert.equal(c.risks[0].level, 'alto');
  assert.ok(c.risks.some((r) => /rinnova da solo/i.test(r.title)) && c.risks.some((r) => /Pagamento a tempi lunghi/.test(r.title)));
});
test('contratto senza scadenza né rinnovo', () => {
  const c = readContract('', 'Accordo di collaborazione tra le parti.', '2026-01-01');
  assert.equal(c.autoRenew, false); assert.ok(c.risks.some((r) => /scadenza/i.test(r.title)));
});
test('date in lettere e ISO', () => {
  assert.deepEqual(datesOf('dal 1 gennaio 2026 al 2027-02-03').map((d) => d.iso), ['2026-01-01', '2027-02-03']);
});
test('scadenze nel Plan e stato', () => {
  const c = readContract('f', TXT, '2026-06-01');
  const d = contractDeadlines(c, '2026-06-01');
  assert.deepEqual(d.map((x) => x.day), ['2026-12-17', '2026-12-31', '2027-03-01']);
  assert.equal(contractState(c, '2026-12-10'), 'disdetta vicina');
  assert.equal(contractState({ end: '2025-01-01' }, '2026-01-01'), 'scaduto');
  assert.equal(contractState({ end: '2030-01-01' }, '2026-01-01'), 'ok');
});
test('adempimenti: da fare, presto, scaduto', () => {
  const rows = dueRows(OBLIGATIONS, { estintori: '2025-12-01', ropa: '2026-05-20', dvr: '2024-01-01' }, '2026-06-10', 'IT');
  const st = (id) => rows.find((r) => r.o.id === id).state;
  assert.equal(st('estintori'), 'scaduto'); // 6 mesi: scaduto il 01/06
  assert.equal(st('ropa'), 'ok'); assert.equal(st('dvr'), 'scaduto'); assert.equal(st('privacy-info'), 'da fare');
  assert.ok(!rows.some((r) => r.o.id === 'suva'));
  assert.equal(rows[0].state, 'scaduto');
});
test('conservazione e lettere', () => {
  assert.equal(keepUntil('2026-01-31', 1), '2027-01-31'); assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.ok(retentionDue({ years: 1 }, '2024-01-01', '2026-01-01'));
  const l = LETTERS.find((x) => x.id === 'sollecito');
  assert.deepEqual(missingFields(l, { cliente: 'Rossi' }).includes('Importo'), true);
  assert.match(fillLetter(l, { cliente: 'Rossi Srl', importo: '100 CHF' }), /Gentile Rossi Srl[\s\S]*\[Fattura n\.\][\s\S]*100 CHF/);
});
