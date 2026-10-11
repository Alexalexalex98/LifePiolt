// node --experimental-strip-types --test tests/billsPlan.test.mjs
// Piano di pagamento, promemoria, rate, ricorrenze, giorni lavorativi, estrazione testo dai PDF.
import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';

import { addBusinessDays, addDays, addMonths, diffDays, easter, holidaysOf, isBusinessDay, weekdayOf } from '../src/lib/bills/dates.ts';
import { buildPlan, dueItemsOf, estimateFixedOutflows, estimateIncomes, lateCost, nextOccurrence, outstanding, sortInvoices, splitInstallments, statusOf, upcoming } from '../src/lib/bills/plan.ts';
import { billPrefix, billReminderId, planBillReminders, atLocal, DEFAULT_BILL_SLOTS } from '../src/lib/bills/reminders.ts';
import { extractPdfText, inflate } from '../src/lib/bills/pdfText.ts';
import { DEFAULT_BILL_PREFS } from '../src/lib/bills/types.ts';

const TODAY = '2026-10-11'; // domenica
const PREFS = { ...DEFAULT_BILL_PREFS };
const mk = (id, o = {}) => ({
  id, issuer: 'ACME', kind: 'luce', amount: 100, currency: 'CHF', dueDate: '2026-10-30', state: 'open', remind: true, createdAt: '2026-10-01T00:00:00Z', history: [], ...o,
});
const fmt = (a, c) => `${c} ${a.toFixed(2).replace('.', ',')}`;

// ---------------------------------------------------------------- date
test('date: aritmetica di calendario, mesi corti, giorni della settimana', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-10-11', '2026-10-30'), 19);
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(addMonths('2026-12-15', 12), '2027-12-15');
  assert.equal(weekdayOf('2026-10-11'), 0);
});
test('festivita\' CH/IT: Pasqua, Venerdi\' santo, 1 agosto, 25 aprile', () => {
  assert.equal(easter(2026), '2026-04-05');
  assert.equal(easter(2025), '2025-04-20');
  const ch = holidaysOf(2026, ['CH']), it = holidaysOf(2026, ['IT']);
  assert.ok(ch.includes('2026-04-03') && ch.includes('2026-04-06') && ch.includes('2026-08-01') && ch.includes('2026-05-14'));
  assert.ok(!ch.includes('2026-04-25'));
  assert.ok(it.includes('2026-04-25') && it.includes('2026-12-08') && it.includes('2026-04-06'));
});
test('giorni lavorativi: salta weekend e festivi, configurabili', () => {
  assert.equal(isBusinessDay('2026-10-10'), false);
  assert.equal(addBusinessDays('2026-10-12', -2), '2026-10-08'); // lunedi' -> giovedi'
  assert.equal(addBusinessDays('2026-04-07', -2, { countries: ['CH'] }), '2026-04-01'); // salta Pasquetta e Venerdi' santo
  assert.equal(addBusinessDays('2026-12-25', 0), '2026-12-24');
  assert.equal(addBusinessDays('2026-11-10', -2, { countries: [], extra: ['2026-11-09'] }), '2026-11-05');
});

// ---------------------------------------------------------------- stati
test('stati: da pagare / in scadenza / scaduta / pagata / rateizzata / contestata', () => {
  assert.equal(statusOf(mk('a', { dueDate: '2026-10-30' }), TODAY), 'da_pagare');
  assert.equal(statusOf(mk('a', { dueDate: '2026-10-18' }), TODAY), 'in_scadenza'); // 7 giorni
  assert.equal(statusOf(mk('a', { dueDate: '2026-10-19' }), TODAY), 'da_pagare');
  assert.equal(statusOf(mk('a', { dueDate: '2026-10-11' }), TODAY), 'in_scadenza'); // oggi non e' ancora in ritardo
  assert.equal(statusOf(mk('a', { dueDate: '2026-10-10' }), TODAY), 'scaduta');
  assert.equal(statusOf(mk('a', { state: 'paid' }), TODAY), 'pagata');
  assert.equal(statusOf(mk('a', { state: 'disputed' }), TODAY), 'contestata');
  assert.equal(statusOf(mk('a', { installments: [{ dueDate: '2026-10-20', amount: 50 }, { dueDate: '2026-11-20', amount: 50 }] }), TODAY), 'rateizzata');
  assert.equal(statusOf(mk('a', { installments: [{ dueDate: '2026-10-01', amount: 50 }, { dueDate: '2026-11-20', amount: 50 }] }), TODAY), 'scaduta');
  assert.equal(statusOf(mk('a', { dueDate: undefined }), TODAY), 'da_pagare');
  assert.equal(statusOf(mk('a', { dueDate: '2026-10-18' }), TODAY, 3), 'da_pagare'); // soglia configurabile
});

// ---------------------------------------------------------------- rate e ricorrenze
test('rate: i centesimi di resto stanno sulla prima, date mensili', () => {
  const r = splitInstallments(100, 3, '2026-11-30');
  assert.deepEqual(r.map((x) => x.amount), [33.34, 33.33, 33.33]);
  assert.deepEqual(r.map((x) => x.dueDate), ['2026-11-30', '2026-12-30', '2027-01-30']);
  assert.equal(Math.round(r.reduce((s, x) => s + x.amount, 0) * 100) / 100, 100);
  assert.equal(splitInstallments(10, 0, '2026-11-01').length, 1);
  assert.equal(splitInstallments(1200, 12, '2026-11-01', 1).length, 12);
});
test('rate: scadenze e importo residuo', () => {
  const inv = mk('r', { installments: [{ dueDate: '2026-10-20', amount: 40, paidAt: '2026-10-19' }, { dueDate: '2026-11-20', amount: 60 }] });
  assert.deepEqual(dueItemsOf(inv).map((d) => [d.key, d.amount, d.n, d.of]), [['r#2', 60, 2, 2]]);
  assert.equal(outstanding(inv), 60);
  assert.deepEqual(dueItemsOf(mk('p', { state: 'paid' })), []);
  assert.deepEqual(dueItemsOf(mk('n', { dueDate: undefined })), []);
});
test('ricorrenza: prossima scadenza stimata dopo il pagamento', () => {
  const nx = nextOccurrence(mk('m', { recurrence: 'monthly', dueDate: '2026-01-31', periodFrom: '2025-12-01', periodTo: '2025-12-31', number: 'X1', reference: 'R' }));
  assert.equal(nx.dueDate, '2026-02-28'); assert.equal(nx.estimated, true); assert.equal(nx.number, undefined); assert.equal(nx.reference, undefined);
  assert.equal(nx.periodFrom, '2026-01-01');
  assert.equal(nextOccurrence(mk('q', { recurrence: 'quarterly', dueDate: '2026-11-15' })).dueDate, '2027-02-15');
  assert.equal(nextOccurrence(mk('y', { recurrence: 'yearly', dueDate: '2026-11-15' })).dueDate, '2027-11-15');
  assert.equal(nextOccurrence(mk('z')), null);
});
test('costo del ritardo: penale + interesse di mora sui giorni', () => {
  assert.equal(lateCost({}, 100, 10), undefined);
  assert.equal(lateCost({ lateFee: 5 }, 100, 10), 5);
  assert.equal(lateCost({ lateInterestPct: 5 }, 365, 73), 3.65);
  assert.equal(lateCost({ lateFee: 5, lateInterestPct: 5 }, 365, 73), 8.65);
});

// ---------------------------------------------------------------- piano
const planOf = (invoices, o = {}) => buildPlan({ invoices, today: TODAY, balance: 1000, currency: 'CHF', prefs: PREFS, ...o });
test('piano: ordinato per scadenza, "paga entro" = scadenza meno margine lavorativo', () => {
  const p = planOf([mk('b', { dueDate: '2026-11-20' }), mk('a', { dueDate: '2026-10-30' })]);
  assert.deepEqual(p.items.map((x) => x.invoiceId), ['a', 'b']);
  assert.equal(p.items[0].payBy, '2026-10-28'); // venerdi' 30 -> mercoledi' 28 (2 gg lavorativi)
  assert.equal(p.items[1].payBy, '2026-11-18');
  assert.equal(p.items[0].status, 'da_pagare');
});
test('piano: scadenza di lunedi\' -> margine salta il weekend', () => {
  const p = planOf([mk('a', { dueDate: '2026-10-26' })]);
  assert.equal(p.items[0].payBy, '2026-10-22'); // lun 26 -2 lav. = gio 22
});
test('piano: margine gia\' consumato -> paga oggi (tight); scaduta -> paga subito con costo del ritardo', () => {
  const p = planOf([mk('t', { dueDate: '2026-10-12' }), mk('o', { dueDate: '2026-10-01', lateFee: 10, lateInterestPct: 10 })]);
  const t = p.items.find((x) => x.invoiceId === 't'), o = p.items.find((x) => x.invoiceId === 'o');
  assert.equal(t.payBy, TODAY); assert.equal(t.tight, true); assert.equal(t.status, 'in_scadenza');
  assert.equal(o.status, 'scaduta'); assert.equal(o.payBy, TODAY);
  assert.equal(o.lateCostIsPotential, false);
  assert.equal(o.lateCost, Math.round((10 + 100 * 0.10 * 10 / 365) * 100) / 100);
  assert.ok(o.advice.some((a) => a.code === 'overdue_now'));
  assert.equal(p.totalOverdue, 100);
  assert.equal(p.items[0].invoiceId, 'o');
});
test('piano: liquidita\' insufficiente -> avviso con importo mancante, priorita\' alle voci con penali', () => {
  const p = planOf([
    mk('pen', { amount: 400, dueDate: '2026-10-30', lateFee: 20 }),
    mk('big', { amount: 700, dueDate: '2026-10-30' }),
  ], { balance: 600 });
  assert.ok(p.warnings.length >= 1);
  const w = p.warnings[0];
  assert.equal(w.missing, 500);
  const pen = p.items.find((x) => x.invoiceId === 'pen'), big = p.items.find((x) => x.invoiceId === 'big');
  assert.equal(pen.shortfall, undefined); // la voce con penali si paga per prima
  assert.equal(big.shortfall, 500);
  assert.ok(big.advice.some((a) => a.code === 'can_postpone'));
  assert.ok(big.advice.some((a) => a.code === 'split'));
  assert.deepEqual(w.postpone, [big.key]);
  assert.equal(p.minBalance.value, -500);
});
test('piano: l\'entrata attesa prima della scadenza viene suggerita, non imposta', () => {
  const p = planOf([mk('a', { amount: 800, dueDate: '2026-10-30' })], { balance: 100, incomes: [{ date: '2026-10-29', amount: 5000 }] });
  const a = p.items[0];
  assert.ok(a.shortfall > 0);
  const adv = a.advice.find((x) => x.code === 'wait_income');
  assert.equal(adv.date, '2026-10-29');
});
test('piano: entrate e spese fisse entrano nel saldo previsto; riserva minima', () => {
  const inc = [{ date: '2026-10-20', amount: 500 }];
  const fixed = [{ date: '2026-10-25', amount: 300 }];
  const p = planOf([mk('a', { amount: 600, dueDate: '2026-10-30' })], { balance: 400, incomes: inc, fixedOutflows: fixed });
  assert.equal(p.items[0].balanceAfter, 0); // 400 + 500 - 300 - 600 = 0
  assert.equal(p.warnings.length, 0);
  const q = planOf([mk('a', { amount: 600, dueDate: '2026-10-30' })], { balance: 400, incomes: inc, fixedOutflows: fixed, prefs: { ...PREFS, reserve: 100 } });
  assert.equal(q.warnings[0].missing, 100);
});
test('piano: importi in un\'altra valuta non entrano nella liquidita\'; bollette senza scadenza sono elencate a parte', () => {
  const p = planOf([mk('eur', { currency: 'EUR', amount: 9999 }), mk('nodate', { dueDate: undefined }), mk('ok', { amount: 50 })], { balance: 100 });
  assert.equal(p.warnings.length, 0);
  assert.deepEqual(p.undated, ['nodate']);
  assert.equal(p.items.find((x) => x.invoiceId === 'eur').foreign, true);
});
test('piano: le rate sono voci separate con "n/of"', () => {
  const inv = mk('r', { installments: splitInstallments(300, 3, '2026-10-25') });
  const p = planOf([inv]);
  assert.equal(p.items.length, 3);
  assert.deepEqual(p.items.map((x) => x.installment), [{ n: 1, of: 3 }, { n: 2, of: 3 }, { n: 3, of: 3 }]);
  assert.equal(p.totalNext30, 100);
});
test('piano: totale da pagare nei prossimi 30 giorni, pagate e contestate escluse', () => {
  const p = planOf([mk('a', { amount: 100, dueDate: '2026-10-20' }), mk('b', { amount: 50, dueDate: '2026-11-09' }), mk('c', { amount: 70, dueDate: '2026-11-15' }), mk('d', { state: 'paid' }), mk('e', { state: 'disputed' })]);
  assert.equal(p.totalNext30, 150);
});
test('lista: ordine per scadenza, poi contestate, poi pagate recenti; barra "prossime scadenze"', () => {
  const l = sortInvoices([mk('p1', { state: 'paid', paidAt: '2026-09-01' }), mk('late', { dueDate: '2026-10-01' }), mk('p2', { state: 'paid', paidAt: '2026-10-05' }), mk('soon', { dueDate: '2026-10-15' }), mk('disp', { state: 'disputed' })]);
  assert.deepEqual(l.map((x) => x.id), ['late', 'soon', 'disp', 'p2', 'p1']);
  const u = upcoming(l, TODAY, 30);
  assert.deepEqual(u.map((x) => x.invoiceId), ['late', 'soon']);
  assert.equal(u[0].overdue, true);
});
test('stima entrate dai movimenti (stipendio mensile) e spese fisse', () => {
  const mv = [
    { date: '2026-07-25', amount: 6500, label: 'Stipendio' }, { date: '2026-08-25', amount: 6500, label: 'Stipendio' }, { date: '2026-09-25', amount: 6500, label: 'Stipendio' },
    { date: '2026-09-10', amount: 50, label: 'Rimborso' },
  ];
  const inc = estimateIncomes(mv, TODAY);
  assert.deepEqual(inc.map((x) => x.date), ['2026-10-25', '2026-11-25']);
  assert.equal(inc[0].amount, 6500);
  assert.deepEqual(estimateIncomes([{ date: '2026-09-25', amount: 6500, label: 'Stipendio' }], TODAY), []);
  const fx = estimateFixedOutflows([{ name: 'Affitto', amount: 1400, freq: 'monthly' }, { name: 'Serafe', amount: 335, freq: 'yearly' }], ['Affitto novembre'], TODAY);
  assert.ok(!fx.some((x) => x.label === 'Serafe'));
  assert.equal(fx.find((x) => x.date === '2026-10-28'), undefined); // gia' visto nei movimenti
  assert.ok(fx.some((x) => x.date === '2026-11-28'));
});

// ---------------------------------------------------------------- promemoria
const NOW = new Date(2026, 9, 11, 9, 0, 0).getTime(); // 11/10/2026 09:00
const rem = (invs, o = {}, prefs = PREFS) => planBillReminders(invs, prefs, { now: NOW, fmt, ...o });
test('promemoria: 7, 3, 1 giorno prima e mattina della scadenza alle 08:30, id deterministici', () => {
  const r = rem([mk('abc', { dueDate: '2026-10-30' })]).all;
  assert.deepEqual(r.slice(0, 4).map((x) => x.id), ['lp-bill-abc-d7', 'lp-bill-abc-d3', 'lp-bill-abc-d1', 'lp-bill-abc-d0']);
  assert.equal(r[0].at, atLocal('2026-10-23', 8, 30));
  assert.equal(r[3].at, atLocal('2026-10-30', 8, 30));
  assert.equal(new Date(r[3].at).getHours(), 8); assert.equal(new Date(r[3].at).getMinutes(), 30);
  assert.ok(r[0].ref === 'bill:abc' && r[0].invoiceId === 'abc');
  assert.ok(r[2].body.includes('ACME') && r[2].body.includes('CHF 100,00') && r[2].body.includes('scade domani'));
  assert.ok(r[0].body.startsWith('Bolletta luce ACME:'));
});
test('promemoria: scaduta -> giorno dopo e poi ogni 3 giorni, 3 volte in tutto', () => {
  const r = rem([mk('abc', { dueDate: '2026-10-30' })]).all.filter((x) => x.kind.startsWith('o'));
  assert.deepEqual(r.map((x) => x.id), ['lp-bill-abc-o1', 'lp-bill-abc-o4', 'lp-bill-abc-o7']);
  assert.equal(r[1].at, atLocal('2026-11-03', 8, 30));
  assert.ok(r[0].body.includes('paga per evitare solleciti'));
});
test('promemoria: i momenti passati non si programmano; scadenza oggi dopo le 08:30', () => {
  const r = rem([mk('x', { dueDate: '2026-10-11' })]).all; // oggi, ma sono le 09:00
  assert.deepEqual(r.map((x) => x.kind), ['o1', 'o4', 'o7']);
  const r2 = rem([mk('y', { dueDate: '2026-10-05' })]).all; // gia' scaduta da giorni: restano solo i futuri
  assert.deepEqual(r2.map((x) => x.kind), ['o7']);
});
test('promemoria: pagate, contestate, disattivate e interruttore generale non producono nulla', () => {
  assert.equal(rem([mk('a', { state: 'paid' }), mk('b', { state: 'disputed' }), mk('c', { remind: false })]).all.length, 0);
  assert.equal(rem([mk('a')], {}, { ...PREFS, on: false }).all.length, 0);
});
test('promemoria: scelta dei momenti e dell\'ora', () => {
  const r = rem([mk('a')], {}, { ...PREFS, d7: false, d3: false, overdue: false, hour: 18, minute: 5 }).all;
  assert.deepEqual(r.map((x) => x.kind), ['d1', 'd0']);
  assert.equal(new Date(r[0].at).getHours(), 18); assert.equal(new Date(r[0].at).getMinutes(), 5);
});
test('promemoria: tetto di slot, i piu\' vicini ora e gli altri rimandati', () => {
  const invs = Array.from({ length: 8 }, (_, i) => mk('i' + i, { dueDate: addDays('2026-10-20', i * 3) }));
  const r = rem(invs, { maxSlots: DEFAULT_BILL_SLOTS });
  assert.equal(r.scheduled.length, 14);
  assert.equal(r.scheduled.length + r.deferred.length, r.all.length);
  assert.ok(r.scheduled.every((x, i, a) => i === 0 || a[i - 1].at <= x.at));
  assert.ok(r.deferred.every((x) => x.at >= r.scheduled[r.scheduled.length - 1].at));
  assert.equal(rem(invs, { maxSlots: 0 }).scheduled.length, 0);
});
test('promemoria: rate con id distinti e testo "rata n/m"', () => {
  const inv = mk('r', { installments: splitInstallments(200, 2, '2026-10-30') });
  const r = rem([inv]).all;
  assert.ok(r.some((x) => x.id === 'lp-bill-r-i1d7') && r.some((x) => x.id === 'lp-bill-r-i2d7'));
  assert.ok(r[0].body.includes('rata 1/2'));
  assert.equal(new Set(r.map((x) => x.id)).size, r.length);
});
test('promemoria: prefisso per cancellare una bolletta non tocca le altre', () => {
  assert.equal(billPrefix('12'), 'lp-bill-12-');
  assert.ok(!billReminderId('123', 'd7').startsWith(billPrefix('12')));
  assert.ok(billReminderId('12', 'd7').startsWith(billPrefix('12')));
});

// ---------------------------------------------------------------- PDF
function mkPdf(content, { flate = true, font = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', extra = [] } = {}) {
  const body = flate ? zlib.deflateSync(Buffer.from(content, 'latin1')) : Buffer.from(content, 'latin1');
  const objs = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'), Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'),
    Buffer.concat([Buffer.from(`<< /Length ${body.length}${flate ? ' /Filter /FlateDecode' : ''} >>\nstream\n`), body, Buffer.from('\nendstream')]),
    Buffer.from(font), ...extra,
  ];
  let out = Buffer.from('%PDF-1.4\n');
  objs.forEach((o, i) => { out = Buffer.concat([out, Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from('\nendobj\n')]); });
  return new Uint8Array(Buffer.concat([out, Buffer.from('trailer << /Root 1 0 R >>\n%%EOF')]));
}
const TXT = 'BT /F1 12 Tf 50 780 Td (ACME Energie AG) Tj 0 -20 Td (Rechnung Nr. 2026-10442) Tj 0 -20 Td [(Total zu zahlen CHF ) -300 (84.53)] TJ 0 -20 Td (Zahlbar bis 04.11.2026) Tj ET';
test('PDF: inflate zlib/deflate e testo con operatori Tj/TJ/Td', () => {
  const raw = Buffer.from('ciao '.repeat(500));
  assert.equal(Buffer.from(inflate(new Uint8Array(zlib.deflateSync(raw)))).toString(), raw.toString());
  assert.equal(Buffer.from(inflate(new Uint8Array(zlib.deflateRawSync(raw)))).toString(), raw.toString());
  assert.equal(Buffer.from(inflate(new Uint8Array(zlib.deflateSync(raw, { level: 0 })))).toString(), raw.toString());
  for (const flate of [true, false]) {
    const r = extractPdfText(mkPdf(TXT, { flate }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.text.split('\n'), ['ACME Energie AG', 'Rechnung Nr. 2026-10442', 'Total zu zahlen CHF 84.53', 'Zahlbar bis 04.11.2026']);
  }
});
test('PDF: font Identity-H con ToUnicode (bfchar e bfrange)', () => {
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <0000> <FFFF> endcodespacerange
2 beginbfchar <0001> <0043> <0002> <0048> endbfchar
1 beginbfrange <0003> <0005> <0046> endbfrange endcmap`;
  const cm = zlib.deflateSync(Buffer.from(cmap));
  const tu = Buffer.concat([Buffer.from(`<< /Length ${cm.length} /Filter /FlateDecode >>\nstream\n`), cm, Buffer.from('\nendstream')]);
  const pdf = mkPdf('BT /F1 12 Tf 50 780 Td <0001000200030004> Tj ET', { font: '<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /ToUnicode 6 0 R >>', extra: [tu] });
  const r = extractPdfText(pdf);
  // il testo e' troppo corto per essere considerato "con testo" (meno di 25 lettere): lo si verifica allungandolo
  assert.equal(r.ok, false);
  const long = 'BT /F1 12 Tf 50 780 Td ' + Array.from({ length: 8 }, () => '<0001000200030004>').join(' Tj 0 -14 Td ') + ' Tj ET';
  const r2 = extractPdfText(mkPdf(long, { font: '<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /ToUnicode 6 0 R >>', extra: [tu] }));
  assert.equal(r2.ok, true);
  assert.equal(r2.text.split('\n')[0], 'CHFG');
});
test('PDF: scansione senza testo, file non PDF e PDF cifrato non fingono di leggere', () => {
  assert.deepEqual(extractPdfText(mkPdf('q 100 0 0 100 0 0 cm /Im0 Do Q')), { ok: false, reason: 'no_text', pages: 1 });
  assert.deepEqual(extractPdfText(new Uint8Array(Buffer.from('non sono un pdf'))), { ok: false, reason: 'not_pdf' });
  assert.deepEqual(extractPdfText(new Uint8Array()), { ok: false, reason: 'not_pdf' });
  const enc = Buffer.concat([Buffer.from(mkPdf(TXT)), Buffer.from('\n9 0 obj\n<< /Filter /Standard /V 4 >>\nendobj\n')]);
  assert.equal(extractPdfText(new Uint8Array(enc)).reason, 'encrypted');
  assert.doesNotThrow(() => extractPdfText(new Uint8Array(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 5 /Filter /FlateDecode >>\nstream\nXXXXX\nendstream\nendobj'))));
});
test('PDF + analisi: il testo estratto da un PDF finisce nella bozza', async () => {
  const { parseBillText } = await import('../src/lib/bills/parse.ts');
  const r = extractPdfText(mkPdf(TXT));
  const d = parseBillText(r.text, { today: TODAY });
  assert.equal(d.amount.value, 84.53); assert.equal(d.dueDate.value, '2026-11-04'); assert.equal(d.issuer.value, 'ACME Energie AG');
});
