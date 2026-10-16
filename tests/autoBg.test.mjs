import test from 'node:test';
import assert from 'node:assert/strict';
import { autoBgKey } from '../src/lib/autoBg.ts';
test('lo sfondo segue il significato e resta stabile', () => {
  assert.ok(['cappuccino', 'colazione', 'caffeInterno', 'tazzeCaffe', 'caffePalme'].includes(autoBgKey('Un buon caffè al mattino')));
  assert.ok(['pizza', 'pizzaBufala', 'cenaCandele', 'burgerArdesia'].includes(autoBgKey('Stasera pizza con gli amici', 'Cucina')));
  assert.equal(autoBgKey('Ciao a tutti'), autoBgKey('Ciao a tutti'));
  assert.equal(autoBgKey('Ciao a tutti'), null);
  assert.equal(autoBgKey(''), null);
});
