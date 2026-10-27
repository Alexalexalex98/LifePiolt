import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProjectRequest, fallbackOutline, cleanAiOutline, withRoot, projectPrompt } from '../src/lib/assistant/projectCore.ts';
import { parseOutline, buildTree } from '../src/lib/projectTree.ts';

test('la richiesta dello screenshot', () => {
  const r = parseProjectRequest('Creami un progetto con sotto progetti chiamato business plan e voglio che dividi il progetto i tutte le task che devo svolgere per completare il business plan');
  assert.equal(r.name, 'Business plan'); assert.equal(r.split, true);
});
test('altre formulazioni', () => {
  assert.equal(parseProjectRequest('crea un progetto per il trasloco').name, 'Trasloco');
  assert.equal(parseProjectRequest('voglio un nuovo progetto che si chiama Orto in terrazza').name, 'Orto in terrazza');
  assert.equal(parseProjectRequest('fammi un progetto sul lancio del mio podcast e dividilo in task').name, 'Lancio del mio podcast');
});
test('non è una creazione', () => {
  assert.equal(parseProjectRequest('quanti progetti ho?'), null);
  assert.equal(parseProjectRequest('ciao come stai'), null);
  assert.equal(parseProjectRequest('crea un progetto'), null);
});
test('modello senza AI → albero a più livelli', () => {
  const body = fallbackOutline('Business plan');
  const { items } = parseOutline(withRoot('Business plan', body));
  const { nodes } = buildTree(items);
  assert.equal(nodes[0].parentIndex, null);
  assert.ok(nodes.length > 30);
  assert.ok(nodes.filter((n) => n.parentIndex === 0).length >= 5);
  assert.ok(fallbackOutline('Orto in terrazza').includes('Pianificazione'));
});
test('risposta dell\'AI ripulita', () => {
  const reply = 'Ecco il piano:\n- Fase uno\n  - Fare A\n  - Fare B\n  - Fare C\n- Fase due\n  * Fare D\n  * Fare E\nFine.';
  const c = cleanAiOutline(reply);
  assert.ok(c.startsWith('- Fase uno'));
  assert.equal(cleanAiOutline('non so'), null);
  assert.match(projectPrompt({ name: 'X', split: true, original: 'crea X' }), /Progetto: «X»/);
});
