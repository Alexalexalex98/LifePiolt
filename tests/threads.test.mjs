import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePost, toggleRepostList, hasReposted, repostCount, quoteCount, repostsOf, threadFlags, compactCount } from '../src/lib/threads.ts';

const posts = [{ id: 1, author: 'Anna', text: 'uno', likes: 2 }, { id: 2, author: 'Marco', text: 'due', likes: 0 }];
const comms = [{ id: 7, posts: [{ author: 'Luca', text: 'in community', likes: 1 }] }];
test('chiavi dei post: standalone e community, il resto è null', () => {
  assert.equal(resolvePost('standalone:2', posts, comms)?.text, 'due');
  assert.equal(resolvePost('community:7:0', posts, comms)?.author, 'Luca');
  assert.equal(resolvePost('standalone:99', posts, comms), null); assert.equal(resolvePost('boh:1', posts, comms), null);
});
test('repost: uno per persona, si annulla con lo stesso gesto; la citazione si aggiunge', () => {
  let l = toggleRepostList([], 'standalone:1', 'Giulia', 10);
  assert.ok(hasReposted(l, 'standalone:1', 'Giulia')); assert.equal(repostCount(l, 'standalone:1'), 1);
  l = toggleRepostList(l, 'standalone:1', 'Giulia', 11); assert.equal(l.length, 0);
  l = toggleRepostList(l, 'standalone:1', 'Giulia', 12, '  bello! '); l = toggleRepostList(l, 'standalone:1', 'Giulia', 13, 'ancora');
  assert.equal(quoteCount(l, 'standalone:1'), 2); assert.equal(repostCount(l, 'standalone:1'), 0); assert.equal(l[1].note, 'bello!');
});
test('i repost di una persona: ordine, e post spariti saltati', () => {
  const l = [{ key: 'standalone:1', by: 'Sara', ts: 5 }, { key: 'standalone:99', by: 'Sara', ts: 9 }, { key: 'standalone:2', by: 'Sara', ts: 8 }, { key: 'standalone:2', by: 'Altro', ts: 1 }];
  assert.deepEqual(repostsOf(l, 'Sara', posts, comms).map((x) => x.post.text), ['due', 'uno']);
});
test('fili: post di fila dello stesso autore si collegano, i repost no', () => {
  const f = threadFlags([{ author: 'A' }, { author: 'A' }, { author: 'A', kind: 'repost' }, { author: 'B' }]);
  assert.deepEqual(f.map((x) => [x.up, x.down]), [[false, true], [true, false], [false, false], [false, false]]);
});
test('numeri compatti', () => { assert.deepEqual([999, 1200, 15300, 2500000].map(compactCount), ['999', '1,2K', '15K', '2,5M']); });
