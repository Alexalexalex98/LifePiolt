import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_TOPICS, searchHelp, looksLikeHelp, helpAnswer, helpAreas } from '../src/lib/helpKb.ts';

test('voci complete e senza doppioni', () => {
  assert.ok(HELP_TOPICS.length >= 25);
  assert.equal(new Set(HELP_TOPICS.map((t) => t.id)).size, HELP_TOPICS.length);
  for (const t of HELP_TOPICS) assert.ok(t.what.length > 20 && t.how.length >= 1 && t.keywords.length >= 2, t.id);
});
test('trova la funzione giusta', () => {
  const top = (q) => searchHelp(q)[0]?.topic.id;
  assert.equal(top('a cosa serve il lifepoint giornaliero?'), 'giornaliero');
  assert.equal(top('come pago con il QR'), 'pagamenti');
  assert.equal(top('come si usa il timer dei task'), 'task');
  assert.equal(top('come funzionano le recensioni'), 'recensioni');
  assert.equal(top('voglio ritirare i soldi'), 'ritiro');
  assert.equal(top('come condivido un file con una persona'), 'drive');
  assert.equal(top('cos è theia'), 'theia');
});
test('domande senza senso: nessuna risposta inventata', () => {
  assert.deepEqual(searchHelp('xyzzy qwerty'), []);
  assert.deepEqual(searchHelp('come'), []);
});
test('riconosce le richieste di aiuto e formatta la risposta', () => {
  assert.ok(looksLikeHelp('come funziona il piano?'));
  assert.ok(!looksLikeHelp('aggiungi dentista giovedì'));
  assert.match(helpAnswer(HELP_TOPICS[0]), /Come si usa/);
  assert.ok(helpAreas().includes('LifePoints'));
});
