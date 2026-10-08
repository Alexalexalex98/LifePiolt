import test from 'node:test';
import assert from 'node:assert/strict';
import { styleText } from '../src/lib/assistant/style.ts';

const A = 'Fatto: «Call» domani dalle 15:00 alle 16:00. Lo trovi nel Plan. Se preferisci un altro orario dimmelo. Puoi anche annullare quando vuoi con "annulla" subito qui.';
test('diretto non cambia', () => assert.equal(styleText(A, 'diretto'), A));
test('breve accorcia', () => {
  const r = styleText(A, 'breve');
  assert.ok(r.length < A.length && r.startsWith('Fatto'));
  assert.ok(!/Se preferisci/.test(r));
  assert.equal(styleText('Ok.', 'breve'), 'Ok.');
});
test('discorsivo aggiunge tono', () => {
  const r = styleText('Fatto: aggiunto.', 'discorsivo');
  assert.ok(r.startsWith('Certo, fatto') && /annullo/.test(r));
  assert.ok(styleText('Hai 3 impegni.', 'discorsivo').startsWith('Ecco: hai'));
});
test('elenchi lunghi in breve', () => {
  const t = ['Titolo', '• a', '• b', '• c', '• d', '• e'].join('\n');
  assert.ok(styleText(t, 'breve').includes('…e altre'));
});
