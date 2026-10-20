import test from 'node:test';
import assert from 'node:assert/strict';
import { toPattern, matchLearned, fillTarget, generalize, looksLikeCommand } from '../src/lib/assistant/learned.ts';
import { parseFixedEdit, findFixed } from '../src/lib/assistant/financeEdit.ts';

test('i numeri diventano segnaposto e la frase si riconosce con altre cifre', () => {
  const item = { id: '1', pattern: toPattern("imposta il budget cibo a 400"), kind: 'cmd', target: 'set budget cibo {n}', uses: 0, ts: 0 };
  assert.equal(item.pattern, 'imposta il budget cibo a {n}');
  const hit = matchLearned("Imposta il budget cibo a 550", [item]);
  assert.ok(hit); assert.deepEqual(hit.nums, ['550']);
  assert.equal(fillTarget(item.target, hit.nums), 'set budget cibo 550');
});
test('articoli e maiuscole non cambiano il senso; frasi diverse non combaciano', () => {
  const item = { id: '1', pattern: toPattern('portami alle palestre'), kind: 'page', target: 'fitnessGyms', uses: 0, ts: 0 };
  assert.ok(matchLearned('Portami alla palestre', [item]));
  assert.equal(matchLearned('portami ai ristoranti', [item]), null);
  assert.equal(matchLearned('portami alle palestre 3', [item]), null);
});
test('generalize: il numero della frase e del comando di esempio diventa {n}', () => {
  assert.equal(generalize('imposta il tetto a 300', 'budget Cibo 300'), 'budget Cibo {n}');
  assert.equal(generalize('apri le palestre', 'open fitnessGyms'), 'open fitnessGyms');
});
test('si riconosce un ordine', () => {
  assert.ok(looksLikeCommand('Imposta l’affitto a 1430'));
  assert.ok(!looksLikeCommand('come sta andando il mese?'));
});
test('imposta una voce fissa: nome, importo, ripristino', () => {
  assert.deepEqual(parseFixedEdit("Imposta l'affitto a 1430 al posto di quello che hai messo"), { word: 'affitto', amount: 1430, undo: false });
  assert.deepEqual(parseFixedEdit('metti la cassa malati a 480,50'), { word: 'cassa malati', amount: 480.5, undo: false });
  assert.deepEqual(parseFixedEdit("ripristina l'affitto"), { word: 'affitto', amount: 0, undo: true });
  assert.equal(parseFixedEdit('apri le finanze'), null);
  const items = [{ name: 'Affitto: S Immo Sa', key: 's immo sa' }, { name: 'Cassa malati e assicurazioni: Helsana', key: 'helsana' }];
  assert.equal(findFixed('affitto', items).key, 's immo sa');
  assert.equal(findFixed('cassa malati', items).key, 'helsana');
  assert.equal(findFixed('mutuo', items), null);
});
