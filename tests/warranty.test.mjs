import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, expiryOf, remaining, progress, statusOf, durationLabel, purchaseTitle, nextExpiry, sortPurchases, summary, reminders, parseWarranty, validDay, daysBetween, DEFAULT_MONTHS, productExpiry } from '../src/lib/warranty.ts';

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
test('lettura sicura dell\'AI', () => {
  const ok = parseWarranty('Ecco:\n{"negozio":"MediaWorld","data":"2026-10-20","valuta":"chf","totale":"1.299,90","prodotti":[{"nome":"Lavatrice Bosch WAN28","marca":"Bosch","modello":"WAN28","seriale":"SN123","prezzo":"649,95","garanzia_mesi":36},{"nome":"Aspirapolvere","garanzia_mesi":null},{"nome":"lavatrice bosch wan28"},{"nome":""}]}', '2026-11-05');
  assert.equal(ok.store, 'MediaWorld'); assert.equal(ok.date, '2026-10-20'); assert.equal(ok.currency, 'CHF'); assert.equal(ok.products.length, 2);
  assert.equal(ok.products[0].months, 36); assert.equal(ok.products[0].assumed, undefined); assert.equal(ok.products[0].price, 649.95); assert.equal(ok.products[1].months, DEFAULT_MONTHS); assert.equal(ok.products[1].assumed, true);
  assert.equal(parseWarranty('{"data":"2030-01-01","prodotti":[{"nome":"Tv"}]}', '2026-11-05').date, null, 'data futura scartata');
  assert.equal(parseWarranty('{"data":"31/12/2025","prodotti":[{"nome":"Tv","garanzia_mesi":999}]}', '2026-11-05').products[0].months, 24);
  assert.equal(parseWarranty('niente json', '2026-11-05'), null); assert.equal(parseWarranty('{"prodotti":[]}', '2026-11-05'), null); assert.equal(parseWarranty('{rotto', '2026-11-05'), null);
  assert.equal(validDay('2026-02-30'), false); assert.equal(validDay('2026-02-28'), true); assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30); assert.equal(productExpiry({ date: '2026-01-31' }, { months: 1 }), '2026-02-28');
});
