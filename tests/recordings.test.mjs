import test from 'node:test';
import assert from 'node:assert/strict';
import { canWatch, lockedReason, recordingsOnProfile, makeRecording } from '../src/lib/recordings.ts';

const rec = (o = {}) => makeRecording({ key: 'seminar:2', kind: 'seminar', title: 'Budget', host: 'Alex', startedAt: 1000, endedAt: 61000, ...o });

test('chi l\'ha tenuta la vede sempre', () => {
  for (const a of ['buyers', 'club', 'private']) assert.equal(canWatch(rec({ access: a }), { viewer: 'Alex', paid: false, clubMember: false }), true);
});
test('chi ha pagato vede quelle per chi ha pagato; gli altri no', () => {
  const r = rec({ access: 'buyers' });
  assert.equal(canWatch(r, { viewer: 'Giulia', paid: true, clubMember: false }), true);
  assert.equal(canWatch(r, { viewer: 'Marco', paid: false, clubMember: true }), false);
});
test('nel LifeClub: iscritti e chi ha pagato; privata: nessuno', () => {
  const c = rec({ access: 'club' });
  assert.equal(canWatch(c, { viewer: 'M', paid: false, clubMember: true }), true);
  assert.equal(canWatch(c, { viewer: 'M', paid: true, clubMember: false }), true);
  assert.equal(canWatch(c, { viewer: 'M', paid: false, clubMember: false }), false);
  assert.equal(canWatch(rec({ access: 'private' }), { viewer: 'M', paid: true, clubMember: true }), false);
});
test('profilo: le private solo al proprietario, dalla più recente', () => {
  const list = [rec({ startedAt: 1000 }), rec({ startedAt: 5000, key: 'seminar:3' }), rec({ startedAt: 9000, key: 'seminar:4', access: 'private' }), makeRecording({ key: 'seminar:9', kind: 'seminar', title: 'X', host: 'Altro', startedAt: 1, endedAt: 2 })];
  assert.deepEqual(recordingsOnProfile(list, 'Alex', 'Giulia').map((r) => r.startedAt), [5000, 1000]);
  assert.deepEqual(recordingsOnProfile(list, 'Alex', 'Alex').map((r) => r.startedAt), [9000, 5000, 1000]);
});
test('messaggi e durata', () => {
  assert.equal(rec().durationMs, 60000);
  assert.match(lockedReason(rec()), /pagato il seminario/);
  assert.match(lockedReason(rec({ access: 'club' })), /LifeClub/);
  assert.equal(lockedReason(rec({ access: 'private' })), null);
});
