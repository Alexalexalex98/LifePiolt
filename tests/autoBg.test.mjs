import test from 'node:test';
import assert from 'node:assert/strict';
import { autoBgKey } from '../src/lib/autoBg.ts';
test('la foto c\'è solo se la frase nomina ciò che la foto mostra', () => {
  assert.ok(['cappuccino', 'colazione', 'caffeInterno', 'tazzeCaffe', 'caffePalme', 'croissantBianco'].includes(autoBgKey('Un buon caffè al mattino')));
  assert.ok(['pizza', 'pizzaBufala'].includes(autoBgKey('Stasera pizza con gli amici')));
  assert.ok(['cucciolo', 'goldenAdulto'].includes(autoBgKey('Il mio cucciolo dorme')));
});
test('frasi astratte restano senza foto (sfondo neutro)', () => {
  assert.equal(autoBgKey('Tre minuti di respirazione prima di ogni riunione cambiano la giornata.', 'Mind'), null);
  assert.equal(autoBgKey('Il progresso non è lineare'), null);
  assert.equal(autoBgKey('Ciao a tutti'), null);
  assert.equal(autoBgKey(''), null);
  assert.equal(autoBgKey('Mente calma', 'Cucina'), null);
});
