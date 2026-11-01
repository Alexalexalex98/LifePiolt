import test from 'node:test';
import assert from 'node:assert/strict';
import { findMissing } from '../src/lib/bills/missing.ts';

const inv = (o) => ({ id: 'x', issuer: 'Netflix', kind: 'abbonamento', amount: 15, currency: 'CHF', state: 'open', remind: true, createdAt: '', history: [], recurrence: 'monthly', ...o });

test('una scadenza stimata passata e mai confermata viene chiesta', () => {
  const m = findMissing([inv({ id: 'a', estimated: true, dueDate: '2026-10-05' })], '2026-10-20');
  assert.equal(m.length, 1); assert.equal(m[0].kind, 'estimated');
});
test('entro i giorni di tolleranza o se gia\' chiesta di recente non si insiste', () => {
  assert.equal(findMissing([inv({ estimated: true, dueDate: '2026-10-19' })], '2026-10-20').length, 0);
  assert.equal(findMissing([inv({ estimated: true, dueDate: '2026-10-05', askedAt: '2026-10-18' })], '2026-10-20').length, 0);
  assert.equal(findMissing([inv({ estimated: true, dueDate: '2026-10-05', askedAt: '2026-10-01' })], '2026-10-20').length, 1);
});
test('una serie che si e\' fermata dopo l\'ultima pagata: manca il mese successivo', () => {
  const m = findMissing([inv({ id: 'p', state: 'paid', dueDate: '2026-08-10' })], '2026-10-20');
  assert.equal(m.length, 1); assert.equal(m[0].kind, 'gap'); assert.equal(m[0].expectedDue, '2026-09-10');
});
test('se c\'e\' gia\' una bolletta aperta nella serie non si chiede niente (e non e\' stimata/scaduta da piu\' di 3 giorni)', () => {
  assert.equal(findMissing([inv({ id: 'p', state: 'paid', dueDate: '2026-09-10' }), inv({ id: 'o', dueDate: '2026-10-25' })], '2026-10-20').length, 0);
});
test('senza ricorrenza non si chiede nulla', () => {
  assert.equal(findMissing([inv({ recurrence: undefined, estimated: true, dueDate: '2026-01-01' })], '2026-10-20').length, 0);
});
