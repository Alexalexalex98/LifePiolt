import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSections } from '../src/lib/dashSections.ts';

const base = { next: null, booked: [], comments: { count: 0 }, invest: { hasHoldings: false, dayPct: 0, totalPct: 0 }, scores: { salute: null, mente: null, finanza: null }, tasks: { open: 0, urgent: 0 }, lifePoints: 2840, now: 1000 };
const by = (rows, id) => rows.find((r) => r.id === id);

test('ordine delle sezioni scelto dall\'utente', () => {
  assert.deepEqual(buildSections(base).map((r) => r.id), ['prossimo', 'prenotati', 'commenti', 'investimenti', 'salute', 'finanze', 'mente', 'task', 'lifepoints']);
});
test('stati vuoti onesti, senza numeri inventati', () => {
  const r = buildSections(base);
  assert.equal(by(r, 'salute').headline, 'Nessun dato'); assert.equal(by(r, 'salute').tone, 'none');
  assert.equal(by(r, 'prenotati').tone, 'none'); assert.equal(by(r, 'investimenti').tone, 'none');
});
test('prenotati: conta solo gli eventi futuri', () => {
  const r = buildSections({ ...base, booked: [{ title: 'Respirazione', count: 12, startsAt: 5000 }, { title: 'Vecchio', count: 40, startsAt: 10 }] });
  assert.equal(by(r, 'prenotati').headline, '12 prenotati');
});
test('colori di stato: salute e investimenti', () => {
  const r = buildSections({ ...base, scores: { salute: 80, mente: 60, finanza: 40 }, invest: { hasHoldings: true, dayPct: -4, totalPct: 8.4 } });
  assert.equal(by(r, 'salute').tone, 'good'); assert.equal(by(r, 'mente').tone, 'warn'); assert.equal(by(r, 'finanze').tone, 'bad');
  assert.equal(by(r, 'investimenti').tone, 'bad'); assert.match(by(r, 'investimenti').detail, /\+8,4%/);
});
test('prossima cosa: oggi evidenziata', () => {
  const r = buildSections({ ...base, next: { title: 'Riunione', time: '11:30', daysAhead: 0 } });
  assert.equal(by(r, 'prossimo').tone, 'warn'); assert.match(by(r, 'prossimo').detail, /Oggi alle 11:30/);
});
