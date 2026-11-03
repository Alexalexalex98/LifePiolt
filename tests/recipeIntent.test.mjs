import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipeIntent, resolveRecipe, findRecipes } from '../src/lib/recipes/intent.ts';

const P = (t, c = { cooking: false }) => parseRecipeIntent(t, c);
test('trova la ricetta per nome', () => {
  assert.equal(resolveRecipe('la carbonara').one?.name, 'Spaghetti alla carbonara');
  assert.equal(resolveRecipe('lasagne alla bolognese').one?.name, 'Lasagne alla bolognese');
  assert.ok(findRecipes('ricetta del tiramisù').length >= 1);
  assert.equal(resolveRecipe('xyzzy').many.length, 0);
});
test('cerca ricette con filtri', () => {
  const a = P('dammi delle ricette veloci vegetariane con zucchine'); assert.equal(a.k, 'search'); assert.deepEqual(a.diets, ['vegetariana']); assert.ok(a.maxMin <= 25); assert.match(a.q, /zucchine/);
  const b = P('un dolce senza glutine'); assert.equal(b.k, 'search'); assert.equal(b.cat, 'Dolci'); assert.deepEqual(b.diets, ['senza glutine']);
  const c = P('cosa posso cucinare con quello che ho in frigo?'); assert.equal(c.k, 'search'); assert.equal(c.fridge, true);
  assert.equal(P('ricette in 20 minuti').maxMin, 20);
  assert.equal(P('che tempo fa domani'), null);
});
test('vedere, cucinare, orario, spesa, preferiti', () => {
  assert.deepEqual(P('come si fa la carbonara per 6 persone'), { k: 'show', id: 'rc-spaghetti-alla-carbonara', servings: 6 });
  assert.equal(P('cuciniamo la carbonara').k, 'cook');
  const pl = P('voglio mangiare la carbonara alle 20:30'); assert.equal(pl.k, 'plan'); assert.equal(pl.h, 20); assert.equal(pl.m, 30);
  assert.equal(P('metti gli ingredienti della carbonara nella lista della spesa').k, 'shop');
  assert.equal(P('mettila nei preferiti', { cooking: false, last: 'rc-x' }).id, 'rc-x');
  assert.equal(P('le mie ricette preferite').list, true);
  assert.equal(P('ho cucinato la carbonara').k, 'cooked');
});
test('timer e diete', () => {
  assert.deepEqual(P('imposta un timer di 10 minuti per la pasta'), { k: 'timer', sec: 600, label: 'pasta' });
  assert.equal(P('ferma il timer').k, 'timerstop'); assert.equal(P('quanto manca al timer').k, 'timers');
  assert.deepEqual(P('sono vegetariano'), { k: 'diet', diets: ['vegetariana'], off: false });
  assert.equal(P('non sono più vegetariano').off, true);
});
test('cucina guidata: comandi brevi solo quando attiva', () => {
  assert.equal(P('avanti'), null); assert.deepEqual(P('avanti', { cooking: true }), { k: 'step', op: 'next' });
  assert.equal(P('indietro', { cooking: true }).op, 'prev'); assert.equal(P('esci', { cooking: true }).op, 'stop');
});
test('sezioni', () => { assert.equal(P('apri il mio diario').page, 'diary'); assert.equal(P('scansiona un prodotto').page, 'foodScan'); });
test('scrivi nel diario', () => { assert.deepEqual(P('scrivi nel diario: oggi è andata bene, sono sereno'), { k: 'diaryadd', text: 'oggi è andata bene, sono sereno' }); assert.equal(P('apri il mio diario').k, 'open'); });
