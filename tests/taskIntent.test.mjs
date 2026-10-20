import test from 'node:test';
import assert from 'node:assert/strict';
import { taskIntent, dialNumber, validPhone, callScript } from '../src/lib/taskIntent.ts';

test('prenotare il dentista è un servizio da prenotare', () => {
  const i = taskIntent('Prenotare il dentista');
  assert.equal(i.kind, 'service'); assert.equal(i.cat.id, 'dentista'); assert.ok(i.book);
});
test('fare la spesa è una lista; chiamare Marco è una chiamata', () => {
  assert.equal(taskIntent('Fare la spesa').kind, 'shopping');
  const c = taskIntent('Chiamare Marco domani');
  assert.equal(c.kind, 'call'); assert.equal(c.person, 'marco');
});
test('task generici non fanno scattare niente', () => {
  assert.equal(taskIntent('Preparare la riunione di lunedì').kind, 'none');
  assert.equal(taskIntent('Rinnovare l’assicurazione auto').kind, 'none');
});
test('numeri e testo della chiamata', () => {
  assert.equal(dialNumber('+41 79 123 45 67'), '+41791234567');
  assert.ok(validPhone('091 123 45 67')); assert.ok(!validPhone('12'));
  const s = callScript({ who: 'Studio Rossi', service: 'una visita di controllo', when: 'per giovedì mattina', name: 'Alex' });
  assert.match(s, /Studio Rossi/); assert.match(s, /una visita di controllo per giovedì mattina/); assert.match(s, /Sono Alex/);
});
