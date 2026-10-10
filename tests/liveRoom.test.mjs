import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/liveRoom.ts';

const T0 = 1_700_000_000_000;

test('stato stanza per orario', () => {
  const start = T0 + 60 * L.MIN;
  assert.equal(L.roomTiming(start, 60, T0).phase, 'upcoming');
  assert.equal(L.roomTiming(start, 60, T0).canEnter, false);
  assert.equal(L.roomTiming(start, 60, start - 10 * L.MIN).phase, 'waiting');
  assert.equal(L.roomTiming(start, 60, start - 10 * L.MIN - 1).phase, 'upcoming');
  assert.equal(L.roomTiming(start, 60, start).phase, 'live');
  assert.equal(L.roomTiming(start, 60, start).canEnter, true);
  assert.equal(L.roomTiming(start, 60, start + 60 * L.MIN).phase, 'ended');
  assert.equal(L.roomTiming(start, 60, start + 60 * L.MIN).canEnter, false);
});

test('conto alla rovescia e promemoria', () => {
  assert.equal(L.countdownLabel(45_000), 'tra 45 s');
  assert.equal(L.countdownLabel(12 * L.MIN), 'tra 12 min');
  assert.equal(L.countdownLabel(135 * L.MIN), 'tra 2 h 15 min');
  assert.equal(L.countdownLabel(51 * 3600000), 'tra 2 g 3 h');
  assert.equal(L.clockLabel(65_000), '01:05');
  assert.equal(L.clockLabel(3_723_000), '1:02:03');
  assert.equal(L.startReminder(T0 + 5 * L.MIN, T0), 'Inizia tra 5 minuti');
  assert.equal(L.startReminder(T0 + 30_000, T0), 'Inizia tra 1 minuto');
  assert.equal(L.startReminder(T0 + 30 * L.MIN, T0), null);
  assert.equal(L.startReminder(T0 - 1, T0), null);
});

test('online: override dell\'organizzatore o dato', () => {
  assert.equal(L.resolveOnline(undefined, 'online'), true);
  assert.equal(L.resolveOnline(undefined, 'presenza'), false);
  assert.equal(L.resolveOnline(false, 'online'), false);
  assert.equal(L.resolveOnline(true, null), true);
  assert.equal(L.modeFor('service'), 'call');
  assert.equal(L.modeFor('seminar'), 'broadcast');
});

test('consiglio di rete', () => {
  assert.equal(L.networkAdvice('WIFI', false).level, 'bad');
  assert.match(L.networkAdvice('WIFI', false).text, /Serve una connessione internet/);
  assert.equal(L.networkAdvice('CELLULAR', true).level, 'warn');
  assert.equal(L.networkAdvice('WIFI', true).level, 'ok');
  assert.equal(L.networkAdvice(null, true).level, 'ok');
});

test('commenti: pulizia, tetto, scadenza overlay', () => {
  assert.equal(L.sanitizeComment('   '), null);
  assert.equal(L.sanitizeComment('  ciao   a  tutti '), 'ciao a tutti');
  assert.ok(L.sanitizeComment('x'.repeat(500)).length <= L.MAX_COMMENT_LEN);
  let list = [];
  for (let i = 0; i < 10; i++) list = L.pushComment(list, { id: 'c' + i, author: 'a', text: 't' + i, ts: T0 + i, kind: 'comment', pinned: i === 0 }, 5);
  assert.equal(list.length, 5);
  assert.ok(list.some((c) => c.id === 'c0'), 'il fissato non esce');
  assert.equal(list.at(-1).id, 'c9');
  const many = Array.from({ length: 20 }, (_, i) => ({ id: 'c' + i, author: 'a', text: 'x', ts: T0 + i * 100, kind: 'comment' }));
  assert.equal(L.overlayComments(many, T0 + 2000).length, L.OVERLAY_MAX);
  assert.equal(L.overlayComments(many, T0 + 2000)[5].id, 'c19');
  assert.equal(L.overlayComments(many, T0 + 60_000).length, 0, 'scaduti');
  const q = [{ id: 'q', author: 'a', text: '?', ts: T0, kind: 'question' }, { id: 's', author: 'a', text: 'x', ts: T0, kind: 'system' }, { id: 'c', author: 'a', text: 'x', ts: T0, kind: 'comment' }];
  const at = L.overlayComments(q, T0 + L.OVERLAY_TTL_MS + 1000).map((c) => c.id);
  assert.deepEqual(at, ['q'], 'le domande restano piu\' a lungo');
  assert.equal(L.commentOpacity(0), 1);
  assert.equal(L.commentOpacity(L.OVERLAY_TTL_MS), 0);
  assert.ok(L.commentOpacity(L.OVERLAY_TTL_MS * 0.8) < 1);
  const pinned = L.pinComment(many, 'c3');
  assert.equal(L.pinnedComment(pinned).id, 'c3');
  assert.equal(L.overlayComments(pinned, T0 + 2000).some((c) => c.id === 'c3'), false);
  assert.equal(L.pinnedComment(L.pinComment(pinned, null)), null);
});

test('ruoli e permessi', () => {
  assert.equal(L.can('host', 'startStop'), true);
  assert.equal(L.can('viewer', 'startStop'), false);
  assert.equal(L.can('viewer', 'pin'), false);
  assert.equal(L.can('viewer', 'removeUser'), false);
  assert.equal(L.can('host', 'muteUser'), true);
  assert.equal(L.can('viewer', 'comment'), true);
  assert.equal(L.can('viewer', 'comment', { muted: true }), false);
  assert.equal(L.can('viewer', 'react', { muted: true }), true);
  assert.equal(L.can('viewer', 'react', { removed: true }), false);
  assert.equal(L.can('viewer', 'camera'), false);
  assert.equal(L.can('viewer', 'camera', { mode: 'call' }), true);
});

test('reazioni con tetto', () => {
  const rs = Array.from({ length: 60 }, (_, i) => ({ id: 'r' + i, kind: 'heart', ts: i, from: 'a' }));
  assert.equal(L.capReactions(rs).length, L.REACTION_CAP);
  assert.equal(L.capReactions(rs).at(-1).id, 'r59');
});

const room = { id: 'seminar:1', title: 'Test', host: 'Anna', kind: 'seminar', mode: 'broadcast' };
async function setup(role, o = {}) {
  let now = T0;
  const tr = L.createSimulatedTransport({ seed: 3, now: () => now, ...o });
  const events = [];
  tr.subscribe((e) => events.push(e));
  await tr.connect(room, { id: 'me', name: role === 'host' ? 'Anna' : 'Io', role });
  return { tr, events, adv: (ms) => { now += ms; tr.tick(now); }, set: (n) => { now = n; } };
}

test('trasporto simulato: connessione, commenti demo, reazioni', async () => {
  const { tr, events, adv } = await setup('viewer');
  assert.equal(tr.provider, 'simulated');
  assert.equal(tr.realVideo, false);
  assert.equal(tr.getState(), 'connected');
  assert.ok(events.some((e) => e.type === 'viewers' && e.count > 0));
  for (let i = 0; i < 60; i++) adv(1000);
  const comments = events.filter((e) => e.type === 'comment');
  assert.ok(comments.length >= 5, 'commenti demo');
  assert.ok(comments.every((e) => !e.comment.mine));
  assert.ok(events.some((e) => e.type === 'reaction'));
  const mine = tr.publishComment('  ciao  ');
  assert.equal(mine.text, 'ciao');
  assert.equal(mine.mine, true);
  assert.equal(tr.publishComment('   '), null);
  tr.publishReaction('heart');
  assert.equal(events.filter((e) => e.type === 'reaction').at(-1).reaction.from, 'Io');
});

test('trasporto simulato: determinismo', async () => {
  const run = async () => { const s = await setup('viewer'); for (let i = 0; i < 30; i++) s.adv(1000); return JSON.stringify(s.events); };
  assert.equal(await run(), await run());
});

test('trasporto simulato: permessi relatore e rete', async () => {
  const v = await setup('viewer');
  v.tr.pin('x'); v.tr.muteParticipant('demo0', true); v.tr.removeParticipant('demo0'); v.tr.endRoom();
  assert.equal(v.events.filter((e) => ['pinned', 'removed', 'ended'].includes(e.type)).length, 0);
  assert.equal(v.events.filter((e) => e.type === 'participants').at(-1).list[0].muted, false);

  const h = await setup('host');
  h.tr.pin('c1');
  assert.deepEqual(h.events.filter((e) => e.type === 'pinned').at(-1), { type: 'pinned', id: 'c1' });
  h.tr.muteParticipant('demo0', true);
  for (let i = 0; i < 120; i++) h.adv(1000);
  assert.ok(!h.events.some((e) => e.type === 'comment' && e.comment.author === 'Giulia'), 'silenziato non scrive');
  h.tr.removeParticipant('demo1');
  assert.ok(h.events.some((e) => e.type === 'removed' && e.id === 'demo1'));
  assert.ok(!h.events.filter((e) => e.type === 'participants').at(-1).list.some((p) => p.id === 'demo1'));
  h.tr.setNetwork(false);
  assert.equal(h.tr.getState(), 'reconnecting');
  const n = h.events.length;
  h.adv(30000);
  assert.equal(h.events.length, n, 'offline: niente nuovi eventi');
  h.tr.setNetwork(true);
  assert.equal(h.tr.getState(), 'connected');
  h.tr.endRoom();
  assert.equal(h.events.at(-1).type, 'state');
  assert.ok(h.events.some((e) => e.type === 'ended'));
  assert.equal(h.tr.publishComment('dopo'), null);
});

test('videochiamata a due: nessun partecipante demo', async () => {
  const tr = L.createSimulatedTransport({ seed: 1 });
  const ev = [];
  tr.subscribe((e) => ev.push(e));
  await tr.connect({ ...room, kind: 'service', mode: 'call' }, { id: 'm', name: 'Io', role: 'viewer' });
  assert.deepEqual(ev.filter((e) => e.type === 'participants').at(-1).list, []);
  assert.equal(ev.filter((e) => e.type === 'viewers').at(-1).count, 1);
});

test('riepilogo', () => {
  const s = L.summarize({ key: 'seminar:1', kind: 'seminar', title: 'T', host: 'A', role: 'viewer', startedAt: T0, endedAt: T0 + 90_000, peakViewers: 12,
    comments: [{ id: '1', author: 'a', text: 'x', ts: 0, kind: 'comment' }, { id: '2', author: 'a', text: 'x', ts: 0, kind: 'question' }, { id: '3', author: 'a', text: 'x', ts: 0, kind: 'system' }], reactions: 7, demo: true });
  assert.equal(s.durationMs, 90_000);
  assert.equal(s.comments, 1);
  assert.equal(s.questions, 1);
  assert.equal(s.peakViewers, 12);
  assert.equal(s.id, `seminar:1@${T0}`);
});
