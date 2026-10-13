import test from 'node:test';
import assert from 'node:assert/strict';
import { startAction, missing, findPerson, findAmount, findPage, isCancel, isYes } from '../src/lib/assistant/appActionCore.ts';

const ctx = { people: ['Giulia M.', 'Marco T.', 'Sophie M.', 'Elena Rossi'] };
const go = (t) => startAction(t, ctx);

test('post: con e senza testo', () => {
  assert.deepEqual(go('Pubblica un post: oggi corsa di 10 km')?.slots, { text: 'oggi corsa di 10 km' });
  const s = go('crea un post sul mio profilo');
  assert.equal(s.action.id, 'post'); assert.equal(missing(s.action, s.slots)?.key, 'text');
});
test('community e lifeclub: nome già detto o richiesto', () => {
  assert.equal(go('Crea una community chiamata Corridori di Lugano')?.slots.name, 'Corridori di Lugano');
  assert.equal(go('crea un lifeclub')?.action.id, 'lifeclub');
  assert.equal(missing(go('crea un lifeclub').action, {})?.key, 'name');
  assert.equal(go('Crea un LifeClub di cucina vegana')?.slots.name, 'cucina vegana');
});
test('invio LifePoints: persona e importo dal testo, conferma obbligatoria', () => {
  const s = go('Invia 10 LifePoints a Giulia');
  assert.deepEqual(s.slots, { to: 'Giulia M.', amount: '10' });
  assert.equal(missing(s.action, s.slots), null);
  assert.match(s.action.confirm(s.slots), /10 LP a Giulia M\./);
  assert.equal(missing(go('manda dei lifepoints a Marco').action, go('manda dei lifepoints a Marco').slots)?.key, 'amount');
  assert.equal(go('Ho speso 12 franchi al supermercato'), null);
});
test('segui, scrivi, apri', () => {
  assert.equal(go('segui Sophie')?.slots.to, 'Sophie M.');
  assert.deepEqual(go('Scrivi a Marco: ci vediamo alle 18')?.slots, { to: 'Marco T.', text: 'ci vediamo alle 18' });
  assert.equal(go('apri le finanze')?.slots.page, 'lifefinance');
  assert.equal(go('vai a i tuoi lifeclub')?.slots.page, 'myClubs');
});
test('non scambia task, note, impegni', () => {
  assert.equal(go('Aggiungi task chiamare Marco'), null);
  assert.equal(go('Cosa devo fare adesso?'), null);
  assert.equal(go('Aggiungi riunione al piano domani alle 15'), null);
});
test('helper', () => {
  assert.equal(findPerson('ciao elena', ctx.people), 'Elena Rossi');
  assert.equal(findAmount('ne voglio dare 7,5'), 7.5);
  assert.equal(findPage('apri note')?.page, 'lifenotes');
  assert.ok(isCancel('Annulla') && isYes('Sì'));
});
