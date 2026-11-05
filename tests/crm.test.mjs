import test from 'node:test';
import assert from 'node:assert/strict';
import { pipeline, winRate, followUpsDue, renewalsSoon, overdueDeals, owed, computeQuote, quoteText, slaOf, validEmail, contactMatches, nextStage, probOf, telUrl } from '../src/lib/crm.ts';

const D = (o) => ({ id: 'd', team_id: 't', contact: 'c', title: 'x', stage: 'lead', amount: 1000, currency: 'CHF', expected_close: null, renewal: null, probability: null, owner: null, notes: '', lost_reason: '', ...o });
test('pipeline: totali e pesati per fase', () => {
  const p = pipeline([D({ stage: 'quote', amount: 2000 }), D({ stage: 'negotiation', amount: 1000 }), D({ stage: 'won', amount: 500 }), D({ stage: 'quote', amount: 400, currency: 'EUR' })], 'CHF');
  assert.equal(p.find((x) => x.stage === 'quote').total, 2000); assert.equal(p.find((x) => x.stage === 'quote').weighted, 1000);
  assert.equal(p.find((x) => x.stage === 'negotiation').weighted, 750); assert.equal(p.find((x) => x.stage === 'won').weighted, 0);
  assert.equal(probOf({ stage: 'quote', probability: 90 }), 90); assert.equal(nextStage('quote'), 'negotiation'); assert.equal(nextStage('won'), null);
});
test('percentuale vinte e trattative in ritardo', () => {
  assert.equal(winRate([D({ stage: 'won' }), D({ stage: 'lost' }), D({ stage: 'lost' }), D({ stage: 'lost' }), D({ stage: 'quote' })]), 25); assert.equal(winRate([D()]), null);
  assert.equal(overdueDeals([D({ stage: 'quote', expected_close: '2026-10-01' }), D({ stage: 'won', expected_close: '2026-10-01' }), D({ expected_close: '2026-12-01' })], '2026-11-05').length, 1);
});
test('richiami e rinnovi', () => {
  const i = (f, done = false) => ({ id: 'i', team_id: 't', contact: 'c', kind: 'call', text: 'x', by: 'u', at: '2026-11-01T10:00:00Z', follow_up: f, follow_done: done });
  assert.equal(followUpsDue([i('2026-11-04'), i('2026-11-09'), i('2026-11-01', true), i(null)], '2026-11-05').length, 1);
  assert.equal(renewalsSoon([D({ stage: 'won', renewal: '2026-12-10' }), D({ stage: 'won', renewal: '2027-06-01' }), D({ stage: 'lead', renewal: '2026-11-10' })], '2026-11-05', 45).length, 1);
});
test('da incassare per valuta con scaduto', () => {
  const r = (a, c, due, paid = false) => ({ id: 'r', team_id: 't', contact: 'c', label: 'f', amount: a, currency: c, due, paid });
  const o = owed([r(100, 'CHF', '2026-10-01'), r(50.5, 'CHF', '2026-12-01'), r(200, 'EUR', null), r(999, 'CHF', '2026-10-01', true)], '2026-11-05');
  assert.deepEqual(o.CHF, { open: 150.5, late: 100 }); assert.deepEqual(o.EUR, { open: 200, late: 0 });
});
test('preventivo: IVA svizzera e italia, sconto, arrotondamento ai 5 centesimi', () => {
  const lines = [{ desc: 'Sito', qty: 1, price: 1000 }, { desc: 'Foto', qty: 3, price: 50 }];
  const ch = computeQuote(lines, 'CH', 'CHF', 10); assert.equal(ch.subtotal, 1150); assert.equal(ch.discount, 115); assert.equal(ch.net, 1035); assert.equal(ch.vat, 83.84); assert.equal(ch.total, 1118.85);
  const it = computeQuote(lines, 'IT', 'EUR'); assert.equal(it.vat, 253); assert.equal(it.total, 1403);
  const t = quoteText({ from: 'Rossi Srl', client: { name: 'Bianchi', company: 'Bianchi SA', address: 'Via Roma 1', vat: 'CHE-123', country: 'CH' }, title: 'Nuovo sito', lines, currency: 'CHF', today: '2026-11-05', number: '12' });
  assert.match(t, /Preventivo n\. 12: Nuovo sito/); assert.match(t, /TOTALE: 1\S?\d{3}[.,]\d{2} CHF/); assert.match(t, /IDI CHE-123/); assert.match(t, /fino al 5\/12\/2026/);
});
test('assistenza: tempi di risposta', () => {
  const now = new Date('2026-11-05T12:00:00Z').getTime();
  assert.equal(slaOf({ priority: 'urgent', status: 'open', created_at: '2026-11-05T05:00:00Z' }, now).late, true);
  assert.equal(slaOf({ priority: 'normal', status: 'open', created_at: '2026-11-05T05:00:00Z' }, now).late, false);
  assert.equal(slaOf({ priority: 'urgent', status: 'resolved', created_at: '2026-11-01T05:00:00Z' }, now).late, false);
});
test('contatti: email, ricerca, telefono', () => {
  assert.equal(validEmail('a@b.ch'), true); assert.equal(validEmail('a@b'), false); assert.equal(validEmail(''), true);
  assert.equal(contactMatches({ name: 'Laura Bianchi', company: 'Studio SA', email: '', phone: '+41 79', vat: '' }, 'studio'), true);
  assert.equal(telUrl('+41 79 123 45 67'), 'tel:+41791234567');
});
