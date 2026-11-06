import test from 'node:test';
import assert from 'node:assert/strict';
import { answer, settle, insuranceKindOf, coverage, legalExpiry, withCoverage, addMonths, expiryOf, remaining, progress, statusOf, durationLabel, purchaseTitle, nextExpiry, sortPurchases, summary, reminders, parseWarranty, validDay, daysBetween, DEFAULT_MONTHS, productExpiry } from '../src/lib/warranty.ts';

const P = (id, date, products, extra = {}) => ({ id, store: 'Negozio', date, currency: 'EUR', products, pages: [], source: 'scan', createdAt: '2026-01-01', ...extra });
const X = (name, months, extra = {}) => ({ id: name, name, months, ...extra });

test('scadenza: mesi e fine mese', () => {
  assert.equal(expiryOf('2026-03-15', 24), '2028-03-15'); assert.equal(addMonths('2026-01-31', 1), '2026-02-28'); assert.equal(addMonths('2024-02-29', 12), '2025-02-28'); assert.equal(expiryOf('2026-11-05', 36), '2029-11-05');
});
test('conto alla rovescia in anni, mesi e giorni', () => {
  assert.equal(remaining('2026-11-05', '2028-02-17').label, 'Mancano 1 anno, 3 mesi e 12 giorni');
  assert.equal(remaining('2026-11-05', '2026-11-06').label, 'Mancano 1 giorno'); assert.equal(remaining('2026-11-05', '2026-11-05').label, 'Scade oggi');
  assert.equal(remaining('2026-11-05', '2026-12-05').label, 'Mancano 1 mese'); assert.equal(remaining('2026-11-05', '2028-11-05').label, 'Mancano 2 anni');
  const e = remaining('2026-11-05', '2026-08-01'); assert.equal(e.expired, true); assert.match(e.label, /^Scaduta da 3 mesi e 4 giorni$/);
  assert.equal(remaining('2026-11-05', '2027-11-04').totalDays, 364);
  assert.equal(remaining('2026-01-31', '2026-03-01').label, 'Mancano 1 mese e 1 giorno'); assert.equal(remaining('2026-11-05', '2027-11-04').label, 'Mancano 11 mesi e 30 giorni');
});
test('avanzamento dalla data di acquisto', () => {
  assert.equal(progress('2026-01-01', '2028-01-01', '2026-01-01'), 0); assert.equal(progress('2026-01-01', '2028-01-01', '2029-01-01'), 1);
  const half = progress('2026-01-01', '2027-01-01', '2026-07-02'); assert.ok(half > 0.49 && half < 0.51); assert.equal(progress('2026-01-01', '2026-01-01', '2026-01-01'), 1);
});
test('stato e durata', () => {
  assert.equal(statusOf('2026-12-01', '2026-11-05'), 'in scadenza'); assert.equal(statusOf('2027-12-01', '2026-11-05'), 'attiva'); assert.equal(statusOf('2026-11-04', '2026-11-05'), 'scaduta'); assert.equal(statusOf('2026-11-05', '2026-11-05'), 'in scadenza');
  assert.equal(durationLabel(24), '2 anni'); assert.equal(durationLabel(18), '1 anno e 6 mesi'); assert.equal(durationLabel(6), '6 mesi'); assert.equal(durationLabel(12), '1 anno');
});
test('titolo con tutti i nomi', () => {
  assert.equal(purchaseTitle(P('a', '2026-01-01', [X('Lavatrice Bosch', 24)])), 'Lavatrice Bosch');
  assert.equal(purchaseTitle(P('a', '2026-01-01', [X('Tv', 24), X('Soundbar', 24)])), 'Tv e Soundbar');
  assert.equal(purchaseTitle(P('a', '2026-01-01', [X('Tv', 24), X('Soundbar', 24), X('Staffa', 12)])), 'Tv, Soundbar e Staffa');
  assert.equal(purchaseTitle(P('a', '2026-01-01', [])), 'Negozio');
});
test('ordine: prima le più vicine alla scadenza, scadute in fondo', () => {
  const T = '2026-11-05';
  const list = [P('lunga', '2026-10-01', [X('A', 36)]), P('scaduta', '2020-01-01', [X('B', 24)]), P('corta', '2025-12-01', [X('C', 12)]), P('mista', '2024-12-01', [X('D', 12), X('E', 36)])];
  assert.deepEqual(sortPurchases(list, T).map((p) => p.id), ['corta', 'mista', 'lunga', 'scaduta']);
  assert.equal(nextExpiry(list[3], T), '2027-12-01');
  const s = summary(list, T); assert.equal(s.products, 5); assert.equal(s.expired, 2); assert.equal(s.active, 3); assert.equal(s.soon, 1);
});
test('promemoria nel Plan', () => {
  const r = reminders(P('a', '2025-12-01', [X('Tv', 12), X('Vecchia', 1)]), '2026-11-05'); assert.equal(r.length, 1); assert.equal(r[0].day, '2026-11-05'); assert.match(r[0].title, /Tv/);
  const f = reminders(P('a', '2026-11-01', [X('Forno', 24)]), '2026-11-05'); assert.equal(f[0].day, '2028-10-02');
});
test('lettura sicura dell\'AI: legale, durata scritta, estensione', () => {
  const ok = parseWarranty('Ecco:\n{"negozio":"MediaWorld","data":"2026-10-20","valuta":"chf","totale":"1.299,90","prodotti":[{"nome":"Lavatrice Bosch WAN28","marca":"Bosch","modello":"WAN28","seriale":"SN123","prezzo":"649,95","garanzia_mesi":36},{"nome":"Aspirapolvere","garanzia_mesi":null},{"nome":"lavatrice bosch wan28"},{"nome":""}]}', '2026-11-05');
  assert.equal(ok.store, 'MediaWorld'); assert.equal(ok.date, '2026-10-20'); assert.equal(ok.currency, 'CHF'); assert.equal(ok.products.length, 2);
  assert.equal(ok.products[0].months, 36); assert.equal(ok.products[0].legal, 24); assert.equal(ok.products[0].assumed, undefined); assert.equal(ok.products[0].price, 649.95);
  assert.equal(ok.products[1].months, 24); assert.equal(ok.products[1].legal, 24); assert.equal(ok.products[1].assumed, true, 'nessuna durata sul documento: vale la garanzia legale');
  assert.equal(ok.extensionsFound, 1);
  assert.equal(parseWarranty('{"data":"2030-01-01","prodotti":[{"nome":"Tv"}]}', '2026-11-05').date, null, 'data futura scartata');
  assert.equal(parseWarranty('{"data":"31/12/2025","prodotti":[{"nome":"Tv","garanzia_mesi":999}]}', '2026-11-05').products[0].months, 24);
  assert.equal(parseWarranty('niente json', '2026-11-05'), null); assert.equal(parseWarranty('{"prodotti":[]}', '2026-11-05'), null); assert.equal(parseWarranty('{rotto', '2026-11-05'), null);
  assert.equal(validDay('2026-02-30'), false); assert.equal(validDay('2026-02-28'), true); assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30); assert.equal(productExpiry({ date: '2026-01-31' }, { months: 1 }), '2026-02-28');
});
test('estensione di garanzia: nel prodotto, a parte, a riga, generale', () => {
  const T = '2026-11-05';
  const inner = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Tv","garanzia_legale_mesi":24,"estensione_mesi":24,"estensione_fornitore":"Samsung","estensione_nome":"Samsung Care+","estensione_costo":99}]}', T).products[0];
  assert.equal(inner.months, 48); assert.equal(inner.legal, 24); assert.deepEqual(inner.ext, { by: 'Samsung', name: 'Samsung Care+', cost: 99 }); assert.equal(inner.assumed, undefined);
  const sep = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Tv Samsung 55"},{"nome":"Soundbar"}],"estensioni":[{"prodotto":"Tv Samsung","mesi":12,"fornitore":"MediaWorld"}]}', T).products;
  assert.equal(sep[0].months, 36); assert.equal(sep[0].ext.by, 'MediaWorld'); assert.equal(sep[1].months, 24); assert.equal(sep[1].assumed, true);
  const row = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Frigorifero Bosch","marca":"Bosch"},{"nome":"Estensione garanzia 36 mesi","prezzo":129}]}', T).products;
  assert.equal(row.length, 1); assert.equal(row[0].months, 60); assert.equal(row[0].ext.cost, 129);
  const gen = parseWarranty('{"data":"2026-10-01","garanzia_generale_mesi":36,"prodotti":[{"nome":"A"},{"nome":"B"}]}', T).products; assert.ok(gen.every((x) => x.months === 36 && !x.assumed));
  const short = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Usato","garanzia_mesi":12}]}', T).products[0]; assert.equal(short.months, 12); assert.equal(short.legal, 12); assert.equal(coverage(short).extended, false);
  const manuf = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Tv","garanzia_mesi":60}]}', T).products[0]; assert.equal(manuf.legal, 24); assert.equal(coverage(manuf).extra, 36);
});
test('copertura: legale ed estensione con due scadenze', () => {
  const x = { months: 48, legal: 24 }; const c = coverage(x); assert.deepEqual([c.legal, c.extra, c.total, c.extended], [24, 24, 48, true]);
  assert.equal(legalExpiry('2026-10-01', x), '2028-10-01'); assert.equal(productExpiry({ date: '2026-10-01' }, x), '2030-10-01');
  assert.equal(coverage({ months: 24 }).extended, false); assert.equal(coverage({ months: 12 }).legal, 12);
  const w = withCoverage({ id: 'a', name: 'A', months: 24, assumed: true }, 24, 12); assert.equal(w.months, 36); assert.equal(w.assumed, false); assert.equal(withCoverage(w, 24, 0).months, 24);
});

const T0 = '2026-11-05';
test('assicurazione sullo scontrino: segnata nei dati, separata dalla garanzia', () => {
  const r = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"iPhone 16","marca":"Apple","garanzia_mesi":24}],"assicurazioni":[{"prodotto":"iPhone","nome":"Assicurazione Furto e Danni","fornitore":"Allianz","costo":"89,90","copertura":"furto e danni","mesi":12,"testo":"ASSICURAZ. FURTO E DANNI 12M"}]}', T0);
  assert.equal(r.questions.length, 0); assert.equal(r.insurancesFound, 1); const x = r.products[0];
  assert.deepEqual([x.ins.kind, x.ins.by, x.ins.cost, x.ins.months], ['furto e danni', 'Allianz', 89.9, 12]); assert.equal(x.months, 24, 'i mesi dell\'assicurazione non si mescolano con quelli della garanzia');
  const row = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Tv","marca":"LG"},{"nome":"Assicurazione furto 24 mesi","prezzo":59}]}', T0); assert.equal(row.products.length, 1); assert.equal(row.products[0].ins.kind, 'furto'); assert.equal(row.products[0].ins.months, 24); assert.equal(row.products[0].ins.cost, 59);
  assert.equal(insuranceKindOf('Protezione rottura schermo'), 'danni'); assert.equal(insuranceKindOf('Care'), 'altro');
});
test('ambiguità: «Care» è estensione o assicurazione? chiede, non indovina', () => {
  const r = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Galaxy S24","marca":"Samsung","garanzia_mesi":24}],"voci_incerte":[{"testo":"Samsung Care+ 24 mesi","costo":99}]}', T0);
  assert.equal(r.questions.length, 1); const q = r.questions[0]; assert.equal(q.ask, 'tipo'); assert.equal(q.product, 0); assert.match(q.text, /Samsung Care\+ 24 mesi/); assert.deepEqual(q.options.map((o) => o.id), ['estensione', 'assicurazione', 'altro']); assert.equal(r.products[0].months, 24, 'finché non si risponde non cambia niente');
  const a = answer(r.products, r.questions, q.id, 'estensione'); assert.equal(a.qs.length, 0); assert.equal(a.items[0].months, 48); assert.equal(a.items[0].ext.cost, 99);
  const b = answer(r.products, r.questions, q.id, 'assicurazione'); assert.equal(b.items[0].ins.cost, 99); assert.equal(b.items[0].months, 24);
  const c = answer(r.products, r.questions, q.id, 'altro'); assert.equal(c.qs.length, 0); assert.equal(c.items[0].ins, undefined); assert.match(c.note, /non è una garanzia/);
  const d = answer(r.products, r.questions, q.id, 'spiega', 'È il servizio di ritiro a domicilio'); assert.match(d.note, /ritiro a domicilio/); assert.equal(d.qs.length, 0);
  assert.equal(r.products[0].ext, undefined, 'le risposte non modificano l\'originale');
});
test('ambiguità: a quale prodotto? e quanto dura?', () => {
  const r = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Tv","marca":"LG"},{"nome":"Soundbar","marca":"Sony"}],"assicurazioni":[{"nome":"Assicurazione danni","costo":40}],"estensioni":[{"nome":"Extra garanzia","fornitore":"MediaWorld"}]}', T0);
  assert.deepEqual(r.questions.map((q) => q.ask), ['prodotto', 'prodotto']); assert.ok(r.questions[0].options.some((o) => o.id === 'p1' && o.label === 'Soundbar'));
  const ins = r.questions.find((q) => q.item.kind === 'assicurazione'); const ext = r.questions.find((q) => q.item.kind === 'estensione');
  let st = { items: r.products, qs: r.questions };
  st = answer(st.items, st.qs, ins.id, 'p1'); assert.equal(st.items[1].ins.cost, 40); assert.equal(st.qs.length, 1);
  st = answer(st.items, st.qs, ext.id, 'p0'); assert.equal(st.qs.length, 1); assert.equal(st.qs[0].ask, 'durata'); assert.equal(st.qs[0].product, 0);
  st = answer(st.items, st.qs, st.qs[0].id, 'm24'); assert.equal(st.qs.length, 0); assert.equal(st.items[0].months, 48); assert.equal(st.items[0].ext.by, 'MediaWorld');
  const none = answer(r.products, r.questions, ins.id, 'nessuno'); assert.equal(none.items.every((x) => !x.ins), true); assert.match(none.note, /non collegata/);
  const unk = parseWarranty('{"data":"2026-10-01","prodotti":[{"nome":"Tv","marca":"LG"}],"estensioni":[{"prodotto":"Tv","nome":"Extra garanzia LG"}]}', T0); assert.equal(unk.questions[0].ask, 'durata'); assert.equal(answer(unk.products, unk.questions, unk.questions[0].id, 'nessuno').items[0].months, 24);
});
test('settle a mano e voci senza prodotti', () => {
  const items = [{ name: 'A', months: 24 }]; const qs = []; settle(items, qs, { kind: 'assicurazione', name: 'Polizza danni', cost: 10 }); assert.equal(items[0].ins.kind, 'danni'); assert.equal(qs.length, 0);
  const empty = []; settle([], empty, { kind: 'assicurazione', name: 'X' }); assert.equal(empty.length, 0);
});
