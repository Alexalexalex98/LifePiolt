import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, QUOTE_CATS, pickQuotes, quoteCount, toggleQuoteLike, catWeight } from '../src/lib/theiaQuotes.ts';

test('ogni categoria ha almeno 5 consigli e gli id sono unici', () => {
  for (const c of QUOTE_CATS) assert.ok(QUOTES.filter((q) => q.cat === c).length >= 5, c);
  assert.equal(new Set(QUOTES.map((q) => q.id)).size, QUOTES.length);
});
test('mi piace su un consiglio aumenta il peso della categoria e si può togliere', () => {
  const q = QUOTES.find((x) => x.cat === 'Calma');
  const a = toggleQuoteLike({}, [], q);
  assert.equal(a.on, true); assert.equal(a.likes.Calma, 1); assert.ok(catWeight(a.likes, 'Calma') > catWeight(a.likes, 'Salute'));
  const b = toggleQuoteLike(a.likes, a.liked, q);
  assert.equal(b.on, false); assert.equal(b.likes.Calma, 0); assert.deepEqual(b.liked, []);
});
test('le categorie apprezzate escono più spesso', () => {
  const likes = { Coraggio: 4 };
  let withLike = 0, base = 0;
  for (let s = 1; s <= 300; s++) { withLike += pickQuotes(likes, 3, s).filter((q) => q.cat === 'Coraggio').length; base += pickQuotes({}, 3, s).filter((q) => q.cat === 'Coraggio').length; }
  assert.ok(withLike > base * 1.8, `${withLike} vs ${base}`);
});
test('la scelta è deterministica, senza doppioni e il numero cresce con i mi piace', () => {
  const a = pickQuotes({}, 4, 7), b = pickQuotes({}, 4, 7);
  assert.deepEqual(a, b); assert.equal(new Set(a.map((q) => q.id)).size, 4);
  assert.equal(quoteCount({}), 2); assert.equal(quoteCount({ Calma: 3, Salute: 5 }), 6);
});
