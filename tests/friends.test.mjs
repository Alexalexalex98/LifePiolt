import test from 'node:test';
import assert from 'node:assert/strict';
import { chatNameFor, mergeFriends, normalizeCode, planIncoming, planOutgoing, showCode } from '../src/lib/friendsCore.ts';

test('codice amico: maiuscolo, senza spazi e trattini, senza lettere ambigue', () => {
  assert.equal(normalizeCode('abcd-2345'), 'ABCD2345');
  assert.equal(normalizeCode(' abcd 2345 '), 'ABCD2345');
  assert.equal(normalizeCode('ABCD234'), null);
  assert.equal(normalizeCode('ABCD234O'), null); // la O non esiste nei codici
  assert.equal(normalizeCode('ABCD2341'), null); // nemmeno l'1
  assert.equal(showCode('ABCD2345'), 'ABCD-2345');
});
test('due amici con lo stesso nome hanno chat diverse', () => {
  assert.equal(chatNameFor('Anna', 'u1', []), 'Anna');
  assert.equal(chatNameFor('Anna', 'u2abcd', [{ id: 'u1', chat: 'Anna' }]), 'Anna u2ab');
  assert.equal(chatNameFor('Anna', 'u1', [{ id: 'u1', chat: 'Anna' }]), 'Anna');
});
test('la lista del server mantiene nome chat e data di inizio già decisi', () => {
  const first = mergeFriends([], [{ id: 'u1', name: 'Anna', status: 'accepted' }], 1000);
  assert.equal(first[0].since, 1000);
  const again = mergeFriends(first, [{ id: 'u1', name: 'Anna R.', status: 'accepted' }], 5000);
  assert.equal(again[0].since, 1000); assert.equal(again[0].chat, 'Anna'); assert.equal(again[0].name, 'Anna R.');
  const pending = mergeFriends([], [{ id: 'u2', name: 'Bruno', status: 'pending_in' }], 2000);
  const acc = mergeFriends(pending, [{ id: 'u2', name: 'Bruno', status: 'accepted' }], 3000);
  assert.equal(acc[0].since, 3000);
});
const friends = [{ id: 'u1', name: 'Anna', chat: 'Anna', status: 'accepted', since: 0 }, { id: 'u2', name: 'Bruno', chat: 'Bruno', status: 'pending_in', since: 0 }];
const row = (id, sender, recipient, t, client) => ({ id, sender, recipient, body: id, client_id: client, created_at: new Date(t).toISOString() });
test('messaggi in arrivo: salta i già visti, i miei da questo telefono e chi non è amico', () => {
  const rows = [row('m1', 'u1', 'me', 1000), row('m2', 'me', 'u1', 2000, 'loc1'), row('m3', 'me', 'u1', 3000, 'altro'), row('m4', 'u2', 'me', 4000), row('m5', 'u9', 'me', 5000), row('m0', 'u1', 'me', 500)];
  const r = planIncoming(rows, 'me', friends, new Set(['m0']), new Set(['loc1']));
  assert.deepEqual(r.todo.map((x) => x.remoteId), ['m1', 'm3']);
  assert.equal(r.todo[1].mine, true);
  assert.ok(r.seenNow.includes('m2') && r.seenNow.includes('m4') && !r.seenNow.includes('m0'));
});
test('messaggi in uscita: solo testo mio, nuovo, dopo l\'inizio dell\'amicizia', () => {
  const msgs = [{ id: 'a', from: 'me', kind: 'text', text: 'ciao', ts: 100 }, { id: 'b', from: 'Anna', kind: 'text', text: 'hey', ts: 110 }, { id: 'c', from: 'me', kind: 'image', ts: 120 }, { id: 'd', from: 'me', kind: 'text', text: 'già', ts: 130 }, { id: 'e', from: 'me', kind: 'text', text: 'vecchio', ts: 5 }, { id: 'f', from: 'me', kind: 'text', text: '  ', ts: 140 }, { id: 'g', from: 'me', kind: 'text', text: 'x', ts: 150, deletedForAll: true }];
  const r = planOutgoing(msgs, 'me', 50, new Set(['d']));
  assert.deepEqual(r.send.map((x) => x.id), ['a']); assert.equal(r.unsupported, 1);
});
