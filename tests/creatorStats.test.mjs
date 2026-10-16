import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, toPct, reachOfItem, h32 } from '../src/lib/creatorStats.ts';

const NOW = 1_800_000_000_000, D = 86400000;
const it = (key, fmt, daysAgo, extra = {}) => ({ key, kind: 'post', fmt, title: key, ts: NOW - daysAgo * D, likes: 20, comments: 3, conv: 0, lp: 0, ...extra });
const ITEMS = [it('a', 'foto', 2), it('b', 'video', 4, { likes: 60, comments: 9, durationSec: 30 }), it('c', 'frase', 10, { likes: 5 }), it('d', 'foto', 40), it('s', 'seminario', 3, { kind: 'seminar', conv: 4, capacity: 20, lp: 80 })];

test('percentuali sempre a 100, anche con arrotondamenti difficili', () => {
  assert.equal(toPct([1, 1, 1]).reduce((a, b) => a + b, 0), 100);
  assert.equal(toPct([33.3, 33.3, 33.4, 0]).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(toPct([0, 0]), [0, 0].map(() => 0).map((_, i) => toPct([0, 0])[i]));
});
test('le statistiche sono ripetibili e il pubblico somma a 100', () => {
  const a = computeStats(ITEMS, 'Alex', 30, NOW), b = computeStats(ITEMS, 'Alex', 30, NOW);
  assert.deepEqual(a, b);
  for (const k of ['age', 'gender']) assert.equal(a.audience[k].reduce((s, x) => s + x.pct, 0), 100);
  assert.equal(a.timing.days.reduce((s, x) => s + x.pct, 0), 100);
  assert.ok(a.audience.cities.length === 5 && a.audience.interests.length === 5);
});
test('il periodo conta: 7 giorni vede meno contenuti di 30, il confronto usa il periodo prima', () => {
  const s7 = computeStats(ITEMS, 'Alex', 7, NOW), s30 = computeStats(ITEMS, 'Alex', 30, NOW);
  assert.ok(s7.n < s30.n);
  assert.ok(s30.kpis.reach.value > s7.kpis.reach.value);
  assert.ok(s30.kpis.reach.prev > 0); // il «d» di 40 giorni fa è nel periodo precedente
});
test('più mi piace e commenti = più contatti stimati', () => {
  assert.ok(reachOfItem(it('x', 'foto', 1, { likes: 100 })) > reachOfItem(it('x', 'foto', 1, { likes: 2 })));
  assert.equal(h32('a'), h32('a'));
});
test('consigli di Theia: nessun contenuto -> invito a iniziare; pochi azioni -> invito all\'azione; sempre l\'orario migliore', () => {
  const empty = computeStats([], 'Nuovo', 30, NOW);
  assert.equal(empty.suggestions[0].id, 'start');
  const s = computeStats(ITEMS, 'Alex', 30, NOW);
  assert.ok(s.suggestions.some((x) => x.id === 'time'));
  assert.ok(s.suggestions.length <= 6);
  const quiet = computeStats([it('z', 'foto', 20)], 'Alex', 90, NOW);
  assert.ok(quiet.suggestions.some((x) => x.id === 'quiet'));
});
test('video: se ci sono video c\'è la ritenzione, altrimenti nulla', () => {
  assert.ok(computeStats(ITEMS, 'Alex', 30, NOW).video);
  assert.equal(computeStats([it('a', 'foto', 1)], 'Alex', 30, NOW).video, null);
});
