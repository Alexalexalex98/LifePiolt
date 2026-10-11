import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRef, parseRef, routeFor, postOf, commonRef, pushData, readPushData, REF_KINDS, isPostId } from '../src/lib/notifyLinks.ts';

test('buildRef/parseRef: andata e ritorno, anche con ":" negli id', () => {
  const r = buildRef('comment', 'community:3:1', 7);
  assert.equal(r, 'comment:community%3A3%3A1:7');
  assert.deepEqual(parseRef(r), { kind: 'comment', args: ['community:3:1', '7'] });
  assert.deepEqual(parseRef(buildRef('follow', 'Marta: S.')), { kind: 'follow', args: ['Marta: S.'] });
  assert.deepEqual(parseRef(buildRef('service', '100%')), { kind: 'service', args: ['100%'] });
  assert.deepEqual(parseRef('seminar:2'), { kind: 'seminar', args: ['2'] });
  assert.deepEqual(parseRef('reminder'), { kind: 'reminder', args: [] });
  assert.deepEqual(parseRef('SYSTEM'), { kind: 'system', args: [] });
});

test('buildRef: argomenti vuoti in coda tolti, in mezzo conservati', () => {
  assert.equal(buildRef('chat', 'dm:Anna'), 'chat:dm%3AAnna');
  assert.equal(buildRef('chat', 'dm:Anna', undefined), 'chat:dm%3AAnna');
  assert.equal(buildRef('like', 'standalone:5', '', 2), 'like:standalone%3A5::2');
  assert.deepEqual(parseRef('like:standalone%3A5::2').args, ['standalone:5', '', '2']);
});

test('parseRef: ref non validi -> null', () => {
  for (const bad of [undefined, null, '', '   ', 'boh', 'boh:1', 'post', 'post:', 'comment:standalone%3A1', 'post:a:b', 'event:2026-10-10', 'follow:', 'chat'])
    assert.equal(parseRef(bad), null, String(bad));
});

test('routeFor: post, commento, like, menzione, risposta', () => {
  assert.deepEqual(routeFor(buildRef('post', 'standalone:12')), { valid: true, page: 'postPage', params: { key: 'standalone:12' } });
  assert.deepEqual(routeFor(buildRef('comment', 'community:3:1', 4)).params, { key: 'community:3:1', commentId: '4', focus: 'comment' });
  assert.equal(routeFor(buildRef('mention', 'standalone:1', 0)).page, 'postPage');
  assert.equal(routeFor(buildRef('reply', 'standalone:1', 2)).params.commentId, '2');
  // like sul post (con attore) e like su un commento (evidenzia il commento)
  assert.deepEqual(routeFor(buildRef('like', 'standalone:7')).params, { key: 'standalone:7', focus: 'like' });
  assert.deepEqual(routeFor(buildRef('like', 'standalone:7', 'Marta S.')).params, { key: 'standalone:7', focus: 'like', actor: 'Marta S.' });
  assert.deepEqual(routeFor(buildRef('like', 'standalone:7', 'Marta S.', 3)).params, { key: 'standalone:7', focus: 'comment', actor: 'Marta S.', commentId: '3' });
  assert.equal(routeFor(buildRef('like', 'standalone:7', '', 3)).params.commentId, '3');
});

test('routeFor: persone, idee, community, chat', () => {
  assert.deepEqual(routeFor(buildRef('follow', 'Marta S.')), { valid: true, page: 'userProfile', params: { name: 'Marta S.', follow: '1' } });
  assert.deepEqual(routeFor(buildRef('idea', 'abc')).params, { id: 'abc' });
  assert.deepEqual(routeFor(buildRef('community', 5)), { valid: true, page: 'communityProfile', params: { id: '5' } });
  assert.deepEqual(routeFor(buildRef('chat', 'dm:Anna')), { valid: true, page: 'conversationPage', params: { id: 'dm:Anna' } });
  assert.deepEqual(routeFor(buildRef('chat', 'g:team', 'm-12')).params, { id: 'g:team', jump: 'm-12' });
});

test('routeFor: seminari, servizi, prenotazioni, lavoro, punti, impegni, bollette', () => {
  assert.deepEqual(routeFor('seminar:2'), { valid: true, page: 'seminarPage', params: { id: '2' } });
  assert.deepEqual(routeFor(buildRef('service', 'Alex')).params, { name: 'Alex' });
  assert.equal(routeFor('booking:b1').dynamic, 'booking');
  const job = routeFor('job:app-9');
  assert.equal(job.dynamic, 'job');
  assert.deepEqual(job.params, { id: 'app-9' });
  assert.equal(job.fallback.page, 'lifenetwork');
  assert.deepEqual(routeFor('points:tx1'), { valid: true, page: 'lifepointsPage', params: { tx: 'tx1' } });
  assert.deepEqual(routeFor(buildRef('event', '2026-10-12', 2)), { valid: true, page: 'plan', params: { day: '2026-10-12', idx: '2' } });
  const bill = routeFor('bill:luce-10');
  assert.equal(bill.page, 'billDetail');
  assert.deepEqual(bill.params, { id: 'luce-10' });
  assert.deepEqual(bill.fallback, { page: 'plan', params: {} });
  assert.deepEqual(routeFor('reminder'), { valid: true, page: 'plan', params: {} });
  assert.equal(routeFor('system').page, 'notificationsPage');
});

test('routeFor: destinazioni non valide', () => {
  for (const bad of [undefined, '', 'boh', 'post:12', 'post:standalone%3Ax', 'comment:standalone%3A1:abc', 'comment:standalone%3A1:-1', 'like:community%3A1', 'like:standalone%3A1:Marta:x',
    'community:abc', 'event:12-10-2026:0', 'event:2026-10-12:x', 'event:2026-10-12']) {
    const r = routeFor(bad);
    assert.equal(r.valid, false, String(bad));
    assert.equal(r.page, 'notificationsPage');
  }
});

test('ogni tipo ha una rotta valida con argomenti corretti', () => {
  const sample = { post: ['standalone:1'], comment: ['standalone:1', 0], like: ['standalone:1'], follow: ['A'], mention: ['standalone:1', 0], reply: ['standalone:1', 0], idea: ['1'], community: ['1'], chat: ['dm:A'], seminar: ['1'], service: ['A'], booking: ['1'], job: ['1'], points: ['1'], event: ['2026-01-01', 0], bill: ['1'], reminder: [], system: [] };
  assert.deepEqual(Object.keys(sample).sort(), [...REF_KINDS].sort());
  for (const [k, args] of Object.entries(sample)) assert.equal(routeFor(buildRef(k, ...args)).valid, true, k);
});

test('postOf, isPostId e commonRef per i gruppi', () => {
  assert.equal(isPostId('standalone:3'), true);
  assert.equal(isPostId('community:1:0'), true);
  assert.equal(isPostId('standalone:x'), false);
  assert.equal(postOf(buildRef('like', 'standalone:3', 'Marta')), 'standalone:3');
  assert.equal(postOf('seminar:2'), null);
  const l1 = buildRef('like', 'standalone:3', 'Marta'), l2 = buildRef('like', 'standalone:3', 'Omar');
  assert.equal(commonRef([l1, l1]), l1);
  assert.equal(commonRef([l1, l2]), buildRef('post', 'standalone:3'));
  assert.equal(commonRef([l1, buildRef('like', 'standalone:4', 'Ines')]), null);
  assert.equal(commonRef([l1, undefined]), null);
  assert.equal(commonRef([]), null);
});

test('dati delle notifiche di sistema (push locali)', () => {
  assert.deepEqual(pushData('seminar:2', 'seminario', 5), { kind: 'seminario', ref: 'seminar:2', nid: 5 });
  assert.deepEqual(pushData(undefined, undefined), {});
  assert.deepEqual(readPushData({ ref: 'post:x', kind: 'sociale', nid: 3 }), { ref: 'post:x', kind: 'sociale', nid: 3 });
  assert.deepEqual(readPushData(null), {});
  assert.deepEqual(readPushData({ ref: 5 }), { ref: undefined, kind: undefined, nid: undefined });
  // promemoria impegni: day + idx
  assert.equal(readPushData({ kind: 'promemoria', day: '2026-10-12', idx: 1 }).ref, 'event:2026-10-12:1');
});
