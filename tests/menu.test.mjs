import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByCat, hasMenu, findItem, itemLine, parsePrice, priceLabel, validateItem, EMPTY_MENU } from '../src/lib/menu.ts';

test('prezzi: virgola o punto, CHF facoltativo, limiti', () => {
  assert.equal(parsePrice('12,50'), 12.5);
  assert.equal(parsePrice('12.5 CHF'), 12.5);
  assert.equal(parsePrice(' 8 '), 8);
  assert.equal(parsePrice('0'), null);
  assert.equal(parsePrice('abc'), null);
  assert.equal(parsePrice('12,555'), null);
  assert.equal(parsePrice('10000'), null);
  assert.equal(priceLabel(12), '12 CHF');
  assert.equal(priceLabel(12.5), '12,50 CHF');
});
test('piatto: nome e prezzo obbligatori, descrizione tagliata', () => {
  assert.equal(validateItem('', '5').ok, false);
  assert.equal(validateItem('Pizza', 'x').ok, false);
  const ok = validateItem(' Pizza ', '14,5', 'a'.repeat(300));
  assert.equal(ok.ok, true);
  assert.equal(ok.name, 'Pizza'); assert.equal(ok.price, 14.5); assert.equal(ok.desc.length, 160);
});
test('menù: raggruppato per categoria nell\'ordine giusto; vuoto senza file né piatti', () => {
  const items = [{ id: 'a', name: 'Tiramisù', price: 9, cat: 'Dolci' }, { id: 'b', name: 'Bruschetta', price: 8, cat: 'Antipasti' }, { id: 'c', name: 'Tagliolini', price: 22, cat: 'Primi' }, { id: 'd', name: 'Cannolo', price: 7, cat: 'Dolci' }];
  assert.deepEqual(groupByCat(items).map((g) => g.cat), ['Antipasti', 'Primi', 'Dolci']);
  assert.deepEqual(groupByCat(items)[2].items.map((x) => x.id), ['a', 'd']);
  assert.equal(hasMenu(EMPTY_MENU), false);
  assert.equal(hasMenu({ files: [{ id: 'f', name: 'm.pdf', uri: 'x', ts: 1 }], items: [], updatedAt: 1 }), true);
  assert.equal(findItem({ files: [], items, updatedAt: 1 }, 'c').name, 'Tagliolini');
  assert.equal(itemLine(items[2]), 'Tagliolini · 22 CHF');
});
