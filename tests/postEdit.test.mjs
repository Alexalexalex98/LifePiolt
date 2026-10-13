import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRef, validatePostText, editStandalone, editInCommunity, removeStandalone, removeInCommunity } from '../src/lib/postEdit.ts';

const posts = [{ id: 1, author: 'Alex', text: 'ciao', tag: 'Fitness' }, { id: 2, author: 'Giulia', text: 'x' }];
const comms = [{ id: 7, posts: [{ author: 'Alex', text: 'a' }, { author: 'Marco', text: 'b' }] }];

test('riferimenti', () => {
  assert.deepEqual(parseRef('standalone:12'), { kind: 'standalone', id: '12' });
  assert.deepEqual(parseRef('community:7:1'), { kind: 'community', id: '7', index: 1 });
  assert.equal(parseRef('idea:3'), null);
  assert.equal(parseRef('community:7:x'), null);
});
test('testo valido', () => {
  assert.ok(validatePostText('  ', false));
  assert.equal(validatePostText('  ', true), null);
  assert.ok(validatePostText('a'.repeat(2001), false));
  assert.equal(validatePostText('ok', false), null);
});
test('modifica solo i propri post e segna "modificato"', () => {
  const r = editStandalone(posts, '1', 'Alex', { text: ' nuovo ', tag: 'Cucina' }, 5);
  assert.equal(r[0].text, 'nuovo'); assert.equal(r[0].tag, 'Cucina'); assert.equal(r[0].editedAt, 5);
  assert.equal(editStandalone(posts, '2', 'Alex', { text: 'hack' }, 5), posts);
  assert.equal(editStandalone(posts, '1', 'Alex', { text: 'ciao' }, 5), posts);
});
test('community: modifica ed elimina solo i propri', () => {
  assert.equal(editInCommunity(comms, '7', 0, 'Alex', 'nuovo', 9)[0].posts[0].editedAt, 9);
  assert.equal(editInCommunity(comms, '7', 1, 'Alex', 'hack', 9)[0].posts[1].text, 'b');
  assert.equal(removeInCommunity(comms, '7', 0, 'Alex')[0].posts.length, 1);
  assert.equal(removeInCommunity(comms, '7', 1, 'Alex')[0].posts.length, 2);
});
test('eliminazione dal profilo: solo i propri', () => {
  assert.deepEqual(removeStandalone(posts, '1', 'Alex').map((p) => p.id), [2]);
  assert.equal(removeStandalone(posts, '2', 'Alex').length, 2);
});
