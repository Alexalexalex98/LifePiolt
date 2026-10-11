import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/lib/profile/reputation.ts';

const NOW = 1_800_000_000_000;
const D = 86400000;
const qa = (from, stars, ref, ts = NOW - 1000, extra = {}) => ({ from, to: 'Anna', stars, ts, ref, ...extra });

test('senza voti né interazioni: nessun punteggio', () => {
  const r = R.computeReputation({ target: 'Anna', now: NOW });
  assert.equal(r.score, null);
  assert.equal(r.confidence, 'nessuna');
  assert.equal(r.votes, 0);
});
test('pochi voti restano vicini alla media a priori (bayesiana)', () => {
  const r = R.computeReputation({ target: 'Anna', direct: { 5: 1 }, now: NOW });
  assert.ok(r.score > 3.5 && r.score < 4.0, String(r.score));
  assert.equal(r.confidence, 'bassa');
  assert.match(r.basedOn, /1 voto/);
});
test('molti voti si avvicinano alla media reale', () => {
  const r = R.computeReputation({ target: 'Anna', direct: { 5: 40 }, now: NOW });
  assert.ok(r.score > 4.7, String(r.score));
  assert.equal(r.confidence, 'alta');
  assert.match(r.basedOn, /40 voti/);
});
test('autovoti, doppioni e voti verso altri sono scartati', () => {
  const votes = [qa('Anna', 5, 'a'), qa('Bea', 5, 'a'), qa('Bea', 1, 'a', NOW - 500), { ...qa('Bea', 5, 'b'), to: 'Carlo' }];
  const v = R.validQaVotes('Anna', votes, NOW);
  assert.equal(v.length, 1);
  assert.equal(v[0].stars, 5);
});
test('rate limit: massimo 10 voti in 24 ore per votante', () => {
  const votes = Array.from({ length: 14 }, (_, i) => qa('Bea', 5, 'r' + i, NOW - 100000 + i * 10));
  assert.equal(R.validQaVotes('Anna', votes, NOW).length, R.RATE_MAX);
  assert.ok(R.qaBlockReason('Bea', 'Anna', 'nuovo', votes, NOW));
  assert.equal(R.qaBlockReason('Bea', 'Anna', 'nuovo', votes, NOW + 2 * D), null);
});
test('blocchi: se stessi e stesso scambio', () => {
  assert.match(R.qaBlockReason('Anna', 'Anna', 'x', [], NOW), /te stesso/);
  assert.match(R.qaBlockReason('Bea', 'Anna', 'a', [qa('Bea', 4, 'a')], NOW), /già votato/);
});
test('peso per anzianità del votante', () => {
  assert.equal(R.ageWeight(NOW - 2 * D, NOW), 0.4);
  assert.equal(R.ageWeight(NOW - 10 * D, NOW), 0.7);
  assert.equal(R.ageWeight(NOW - 90 * D, NOW), 1);
  assert.equal(R.ageWeight(undefined, NOW), 0.6);
  const many = (p) => Array.from({ length: 6 }, (_, i) => qa(p + i, 5, 'a'));
  const nuovo = R.computeReputation({ target: 'Anna', qa: many('N'), now: NOW, sinceOf: () => NOW - D });
  const vecchio = R.computeReputation({ target: 'Anna', qa: many('V'), now: NOW, sinceOf: () => NOW - 200 * D });
  assert.ok(vecchio.score > nuovo.score);
});
test('non utile limita le stelle a 2', () => {
  assert.equal(R.effectiveStars({ stars: 5, helpful: false }), 2);
  assert.equal(R.effectiveStars({ stars: 5, helpful: true }), 5);
  assert.equal(R.effectiveStars({ stars: 9 }), 5);
});
test('interazioni: contano poco e saturano (anti-farming)', () => {
  const poche = R.computeReputation({ target: 'Anna', interactions: { likes: 60, saves: 5, lpDonors: 2 }, now: NOW });
  const tante = R.computeReputation({ target: 'Anna', interactions: { likes: 100000, saves: 100000, lpDonors: 100000 }, now: NOW });
  assert.ok(poche.score > 3.5 && poche.score < tante.score);
  assert.ok(tante.score < 4.2, String(tante.score));
  assert.equal(tante.confidence, 'bassa');
  assert.match(tante.basedOn, /interazioni/);
  assert.equal(R.interactionPoints({ likes: 1e6, saves: 1e6, lpDonors: 1e6 }), 200 + 100 + 60);
});
test('scomposizione trasparente: tre parti', () => {
  const r = R.computeReputation({ target: 'Anna', direct: { 4: 2 }, qa: [qa('Bea', 5, 'a')], interactions: { likes: 20, saves: 2, lpDonors: 1 }, now: NOW, sinceOf: () => NOW - 100 * D });
  assert.deepEqual(r.parts.map((p) => p.id), ['profilo', 'risposte', 'interazioni']);
  assert.equal(r.parts[0].n, 2); assert.equal(r.parts[0].avg, 4);
  assert.equal(r.parts[1].n, 1); assert.equal(r.parts[1].avg, 5);
  assert.equal(r.votes, 3);
});
test('chi può votare il profilo: basta essersi iscritti una volta', () => {
  const enrolled = [{ host: 'Anna', status: 'enrolled' }];
  assert.equal(R.canVoteProfile('Bea', 'Anna', enrolled), true);
  assert.equal(R.canVoteProfile('Bea', 'Anna', [{ host: 'Anna', status: 'declined' }]), false);
  assert.equal(R.canVoteProfile('Bea', 'Anna', [{ host: 'Anna', status: 'attended', voted: true }]), false);
  assert.equal(R.canVoteProfile('Anna', 'Anna', enrolled), false);
  assert.equal(R.canVoteProfile('Bea', 'Anna', []), false);
  assert.match(R.profileVoteBlockReason('Bea', 'Anna', []), /almeno una volta/);
  assert.match(R.profileVoteBlockReason('Bea', 'Anna', [{ host: 'Anna', status: 'attended', voted: true }]), /già votato/);
  assert.equal(R.profileVoteBlockReason('Bea', 'Anna', enrolled), null);
});
