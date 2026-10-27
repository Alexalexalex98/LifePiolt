import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateMinutes, nudge, fmtMin, verbOf } from '../src/lib/workEstimate.ts';

test('stime dal testo', () => {
  assert.equal(estimateMinutes('Chiamare il fornitore'), 10);
  assert.equal(estimateMinutes('Fare una cosa'), 25);
  assert.ok(estimateMinutes('Scrivere la prima bozza di ogni capitolo') >= 60);
  for (const t of ['Prenotare', 'Analizzare il mercato e i concorrenti diretti e indiretti del settore', 'x']) { const m = estimateMinutes(t); assert.ok(m >= 5 && m <= 120 && m % 5 === 0, t); }
});
test('impara da quanto ci hai messo', () => {
  const h = [{ verb: verbOf('Chiamare a'), est: 10, actual: 30 }, { verb: 'chiam', est: 10, actual: 30 }];
  assert.ok(estimateMinutes('Chiamare il cliente', h) > estimateMinutes('Chiamare il cliente'));
});
test('formato e incoraggiamento', () => {
  assert.equal(fmtMin(75), '1 h 15 min'); assert.equal(fmtMin(25), '25 min');
  assert.match(nudge(0.05, true), /pezzo più piccolo/); assert.match(nudge(1.2, true), /finito/); assert.match(nudge(0.4, false), /pausa/i);
});
