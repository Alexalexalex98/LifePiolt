import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/lib/profile/skills.ts';

const decl = (id) => ({ id, label: id, declaredAt: 1 });
const req = (o) => ({ id: 'r' + Math.random(), skill: 'x', by: 'Acme', to: 'Anna', createdAt: 100, status: 'requested', ...o });

test('dichiarata senza prove', () => assert.equal(S.statusOf(undefined, []).status, 'declared'));
test('verificata da test sopra soglia, non confermata sotto', () => {
  assert.equal(S.statusOf({ test: { score: 50, ts: 10 } }, []).status, 'verified_test');
  assert.equal(S.statusOf({ test: { score: 49, ts: 10 } }, []).status, 'unconfirmed');
  assert.equal(S.CONFIRM_MIN, 50);
});
test('test in valutazione (provvisorio) non conta come verifica', () => assert.equal(S.statusOf({ test: { score: 90, ts: 10, provisional: true } }, []).status, 'declared'));
test('verificata dal vivo', () => assert.equal(S.statusOf({ live: { score: 80, ts: 20 } }, []).status, 'verified_live'));
test('vale l\'esito più recente: test fallito dopo uno riuscito -> non confermata', () => {
  assert.equal(S.statusOf({ test: { score: 30, ts: 50 }, live: { score: 90, ts: 20 } }, []).status, 'unconfirmed');
  assert.equal(S.statusOf({ test: { score: 70, ts: 50 }, live: { score: 20, ts: 20 } }, []).status, 'verified_test');
});
test('richiesta aperta -> in verifica; rifiutata -> non verificata', () => {
  assert.equal(S.statusOf(undefined, [req({})]).status, 'in_verification');
  assert.equal(S.statusOf(undefined, [req({ status: 'accepted' })]).status, 'in_verification');
  const d = S.statusOf(undefined, [req({ status: 'declined', respondedAt: 120 })]);
  assert.equal(d.status, 'unconfirmed');
  assert.equal(d.declinedBy, 'Acme');
  // dopo una prova riuscita successiva alla richiesta la competenza è verificata
  assert.equal(S.statusOf({ test: { score: 80, ts: 500 } }, [req({ status: 'accepted' })]).status, 'verified_test');
});
test('quota N su M', () => {
  const st = S.skillStates([decl('a'), decl('b'), decl('c')], { a: { test: { score: 80, ts: 1 } }, b: { test: { score: 10, ts: 1 } } }, []);
  const q = S.quota(st);
  assert.equal(q.verified, 1); assert.equal(q.total, 3);
  assert.equal(q.text, '1 su 3 competenze verificate');
  assert.equal(S.quota([]).total, 0);
});
test('competenze sul biglietto: max 5, solo quelle dichiarate, prima le verificate', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const st = S.skillStates(ids.map(decl), { g: { test: { score: 90, ts: 1 } } }, []);
  const c = S.cardSkills(st, undefined);
  assert.equal(c.length, 5);
  assert.equal(c[0].id, 'g');
  assert.deepEqual(S.cardSkills(st, ['b', 'zzz', 'a']).map((x) => x.id), ['b', 'a']);
});
test('dichiarazione: validazione', () => {
  assert.ok(S.validateDeclare(' ', []));
  assert.ok(S.validateDeclare('Excel', [decl('excel')]));
  assert.equal(S.validateDeclare('Excel', []), null);
  assert.ok(S.validateDeclare('x'.repeat(41), []));
  assert.ok(S.validateDeclare('Nuova', Array.from({ length: 30 }, (_, i) => decl('s' + i))));
});
test('richieste di verifica', () => {
  assert.ok(S.requestBlockReason('Anna', 'Anna', 's', []));
  assert.equal(S.requestBlockReason('Acme', 'Anna', 's', []), null);
  assert.ok(S.requestBlockReason('Acme', 'Anna', 's', [req({ skill: 's' })]));
  assert.equal(S.requestBlockReason('Acme', 'Anna', 's', [req({ skill: 's', status: 'declined' })]), null);
  const r = req({});
  assert.equal(S.respond(r, true, 5).status, 'accepted');
  assert.equal(S.respond(S.respond(r, false, 5), true, 6), null);
});
