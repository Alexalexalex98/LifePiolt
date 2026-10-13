import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/lib/groupCall.ts';

const T0 = Date.UTC(2026, 9, 14, 16, 0);
const M = 60000;
const sched = () => G.makeScheduled({ title: 'Riunione', startsAt: T0, video: true, by: 'Alex' });
const members = ['Alex', 'Marco T.', 'Giulia M.', 'Federica L.'];

test('fasi: prima, aperta, finita', () => {
  const c = sched();
  assert.equal(G.phase(c, T0 - 1), 'upcoming');
  assert.equal(G.phase(c, T0), 'open');
  assert.equal(G.phase(c, T0 + (60 + 119) * M), 'open');
  assert.equal(G.phase(c, T0 + (60 + 121) * M), 'ended');
  assert.equal(G.phase(G.applyEnd(c, T0 + M), T0 + 2 * M), 'ended');
});
test('conferma e entrata: solo chi ha confermato, e solo a stanza aperta', () => {
  let c = sched();
  c = G.applyRsvp(c, 'Marco T.', 'yes'); c = G.applyRsvp(c, 'Giulia M.', 'no');
  assert.equal(G.canEnter(c, 'Marco T.', T0 - M), false);
  assert.equal(G.canEnter(c, 'Marco T.', T0), true);
  assert.equal(G.canEnter(c, 'Giulia M.', T0), false);
  assert.equal(G.canEnter(c, 'Federica L.', T0), false);
  assert.equal(G.canEnter(c, 'Alex', T0), true);
  assert.deepEqual(G.confirmedList(c), ['Alex', 'Marco T.']);
  assert.deepEqual(G.declinedList(c), ['Giulia M.']);
});
test('chi la fissa non può dire di no; chi cambia idea esce dagli invitati', () => {
  let c = sched();
  assert.equal(G.applyRsvp(c, 'Alex', 'no'), c);
  c = { ...c, invited: ['Federica L.'] };
  assert.deepEqual(G.applyRsvp(c, 'Federica L.', 'no').invited, []);
});
test('fissata in alto: solo a chi ha confermato, finché non è finita', () => {
  const c = G.applyRsvp(sched(), 'Marco T.', 'yes');
  const msgs = [{ id: '1', from: 'Alex', kind: 'call', call: c }, { id: '2', from: 'x', kind: 'text' }, { id: '3', from: 'Alex', kind: 'call', call: G.applyEnd(sched(), T0) }];
  assert.deepEqual(G.pinnedFor(msgs, 'Marco T.', T0 - 3600000).map((m) => m.id), ['1']);
  assert.deepEqual(G.pinnedFor(msgs, 'Giulia M.', T0 - 3600000), []);
  assert.deepEqual(G.pinnedFor(msgs, 'Marco T.', T0 + 10 * M).map((m) => m.id), ['1']);
  assert.deepEqual(G.pinnedFor(msgs, 'Marco T.', T0 + 400 * M), []);
});
test('invitare da dentro: solo chi è presente, solo persone del gruppo (call programmata)', () => {
  let c = G.applyRsvp(sched(), 'Marco T.', 'yes');
  const ctx = { groupMembers: members, now: T0 + M };
  assert.match(G.inviteError(c, 'Marco T.', 'Giulia M.', ctx), /nella chiamata/);
  c = G.applyJoin(G.applyJoin(c, 'Alex'), 'Marco T.');
  assert.equal(G.inviteError(c, 'Marco T.', 'Giulia M.', ctx), null);
  assert.match(G.inviteError(c, 'Marco T.', 'Estraneo', ctx), /gruppo/);
  assert.match(G.inviteError(c, 'Alex', 'Marco T.', ctx), /già invitata/);
  assert.match(G.inviteError(c, 'Alex', 'Giulia M.', { ...ctx, now: T0 - M }), /non è aperta/);
  const r = G.applyInvite(c, 'Alex', 'Giulia M.', ctx);
  assert.equal(r.error, undefined); assert.equal(G.canEnter(r.call, 'Giulia M.', T0 + M), true);
  assert.deepEqual(G.inviteCandidates(c, members, ['Estraneo', 'Altro']), ['Giulia M.', 'Federica L.']);
});
test('chiamata istantanea: parte subito e si può aggiungere chiunque', () => {
  const c = G.makeInstant({ video: false, by: 'Alex', now: T0, invited: ['Marco T.'] });
  assert.equal(G.phase(c, T0), 'open'); assert.equal(c.restrictToGroup, false);
  assert.equal(G.canEnter(c, 'Marco T.', T0), true);
  assert.equal(G.inviteError(c, 'Alex', 'Estraneo', { groupMembers: [], now: T0 }), null);
  assert.deepEqual(G.inviteCandidates(c, ['Marco T.'], ['Estraneo']), ['Estraneo']);
  assert.equal(G.applyLeave(c, 'Alex', T0 + M).endedAt, T0 + M); // l'ultimo che esce la chiude
});
test('promemoria: confermato ma non entrato, a 3 minuti dall\'apertura, una volta sola', () => {
  let c = G.applyRsvp(sched(), 'Marco T.', 'yes'); c = G.applyJoin(c, 'Alex');
  assert.deepEqual(G.toRemind(c, T0 + 2 * M), []);
  assert.deepEqual(G.toRemind(c, T0 + 3 * M), ['Marco T.']);
  assert.deepEqual(G.toRemind({ ...c, reminded: ['Marco T.'] }, T0 + 5 * M), []);
  assert.deepEqual(G.toRemind(G.applyJoin(c, 'Marco T.'), T0 + 5 * M), []);
  assert.deepEqual(G.reminderTimes(c).map((r) => (r.at - T0) / M), [-10, 0, 3]);
});

test('come nelle dirette: mano alzata, silenzia e rimuovi solo per chi organizza', () => {
  let c = G.applyRsvp(sched(), 'Marco T.', 'yes'); c = G.applyJoin(G.applyJoin(c, 'Alex'), 'Marco T.');
  c = G.applyHand(c, 'Marco T.', true); assert.deepEqual(c.hands, ['Marco T.']);
  assert.deepEqual(G.applyHand(c, 'Marco T.', false).hands, []);
  assert.equal(G.applyMute(c, 'Marco T.', 'Alex', true), c);           // un partecipante non silenzia
  assert.deepEqual(G.applyMute(c, 'Alex', 'Marco T.', true).muted, ['Marco T.']);
  assert.equal(G.applyMute(c, 'Alex', 'Alex', true), c);               // l'organizzatore non silenzia se stesso
  const r = G.applyRemove(c, 'Alex', 'Marco T.');
  assert.equal(G.canEnter(r, 'Marco T.', T0 + M), false); assert.deepEqual(r.joined, ['Alex']); assert.deepEqual(r.hands, []);
  assert.equal(G.applyRemove(c, 'Marco T.', 'Alex'), c);
});
test('elenco delle persone con il loro stato', () => {
  let c = G.applyRsvp(sched(), 'Marco T.', 'yes'); c = G.applyRsvp(c, 'Giulia M.', 'no'); c = { ...c, invited: ['Federica L.'] };
  c = G.applyJoin(c, 'Alex');
  assert.deepEqual(G.peopleOf(c), [{ name: 'Alex', state: 'presente' }, { name: 'Marco T.', state: 'confermato' }, { name: 'Federica L.', state: 'invitato' }, { name: 'Giulia M.', state: 'rifiutato' }]);
});
