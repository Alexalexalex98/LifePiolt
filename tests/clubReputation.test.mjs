import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/lib/club/index.ts';

test('qaRating: media smorzata con pochi voti', () => {
  assert.equal(C.qaRating([]).rating, 3.5);
  assert.equal(C.qaRating([]).confidence, 'nessuna');
  const one = C.qaRating([5]);
  assert.ok(one.rating > 3.5 && one.rating < 4.5, String(one.rating));
  const many = C.qaRating(Array(50).fill(5));
  assert.ok(many.rating > 4.8);
  assert.equal(many.confidence, 'alta');
  assert.ok(C.qaRating([1]).rating < 3.5);
  assert.equal(C.qaRating([{ stars: 5, weight: 0 }]).n, 0);
  assert.equal(C.qaRating([9, -3]).n, 2);
});

test('qaScore: il voto di chi chiede pesa piu di quello degli altri', () => {
  const a = C.qaScore({ votes: [{ stars: 5, asker: true }, { stars: 1, asker: false }] });
  const b = C.qaScore({ votes: [{ stars: 1, asker: true }, { stars: 5, asker: false }] });
  assert.ok(a.rating > b.rating);
});

test('qaScore: like, salvataggi e LifePoint contano ma con tetto', () => {
  const base = C.qaScore({ votes: [{ stars: 3, asker: true }] });
  const more = C.qaScore({ votes: [{ stars: 3, asker: true }], likes: 5, saves: 3, points: 2 });
  assert.ok(more.rating > base.rating);
  // nessun voto esplicito: i segnali impliciti da soli non spostano il punteggio
  const none = C.qaScore({ votes: [], likes: 100, saves: 100, points: 3 });
  assert.equal(none.rating, 3.5);
  // tetto: 1 voto da 1 stella non viene cancellato da mille like
  const capped = C.qaScore({ votes: [{ stars: 1, asker: true }], likes: 1000, points: 3 });
  const huge = C.qaScore({ votes: [{ stars: 1, asker: true }], likes: 1000000, points: 3 });
  assert.equal(capped.rating, huge.rating);
  assert.ok(capped.rating < 4.5);
});

test('anti-abuso: un voto per scambio, non se stessi, solo dopo iscrizione, limite giornaliero', () => {
  const ok = { voter: 'Ugo', asker: 'Ugo', answerer: 'Laura', voterEverJoined: true, alreadyVotedExchange: false, voterVoteTimes: [], now: 1e12 };
  assert.equal(C.canVoteAnswer(ok).ok, true);
  assert.equal(C.canVoteAnswer({ ...ok, voter: 'Laura' }).reason, 'Non puoi votare te stesso');
  assert.match(C.canVoteAnswer({ ...ok, voterEverJoined: false }).reason, /iscritto/);
  assert.match(C.canVoteAnswer({ ...ok, alreadyVotedExchange: true }).reason, /già votato/);
  const times = Array(C.DAILY_VOTE_LIMIT).fill(1e12 - 1000);
  assert.match(C.canVoteAnswer({ ...ok, voterVoteTimes: times }).reason, /limite/);
  assert.equal(C.canVoteAnswer({ ...ok, voterVoteTimes: times.map(() => 1e12 - 2 * 86400000) }).ok, true);
  assert.equal(C.thumbToStars(true), 5); assert.equal(C.thumbToStars(false), 1);
  assert.equal(C.isExchange({ author: 'A' }, { author: 'B' }), true);
  assert.equal(C.isExchange({ author: 'A' }, { author: 'A' }), false);
});
