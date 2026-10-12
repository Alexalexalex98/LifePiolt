import test from 'node:test';
import assert from 'node:assert/strict';
import * as Q from '../src/lib/quickReply.ts';
import { buildRef } from '../src/lib/notifyLinks.ts';

test('a cosa si può rispondere dalla notifica', () => {
  assert.deepEqual(Q.replyTarget(buildRef('comment', 'standalone:3', 1)), { type: 'comment', postKey: 'standalone:3' });
  assert.deepEqual(Q.replyTarget(buildRef('mention', 'community:2:1', 0)), { type: 'comment', postKey: 'community:2:1' });
  assert.deepEqual(Q.replyTarget(buildRef('chat', 'dm:Anna')), { type: 'chat', chatId: 'dm:Anna' });
  assert.equal(Q.replyTarget(buildRef('follow', 'Anna')), null);
  assert.equal(Q.replyTarget('reminder'), null);
  assert.equal(Q.replyTarget(undefined), null);
  assert.equal(Q.canReply(buildRef('post', 'standalone:3')), true);
});
test('testo della risposta', () => {
  assert.equal(Q.sanitizeReply('  ciao   a  tutti '), 'ciao a tutti');
  assert.equal(Q.sanitizeReply('   '), null);
  assert.equal(Q.sanitizeReply(5), null);
  assert.equal(Q.sanitizeReply('a'.repeat(900)).length, Q.REPLY_MAX);
});
