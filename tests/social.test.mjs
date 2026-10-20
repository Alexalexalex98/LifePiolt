import test from 'node:test';
import assert from 'node:assert/strict';
import { hashId, toLocalPost, toInsertRow, mergeRemote, isSafeShared, shareBlock } from '../src/social/socialCore.ts';

const row = (o = {}) => ({ id: 'aaaaaaaa-0000-0000-0000-000000000001', author_id: 'u1', author_name: 'Nadia P.', body: 'Ciao', media: null, media_url: null, media_urls: [], poster_url: null, tag: 'Genitori', fx: null, caption_mode: null, comments_off: false, hide_likes: false, likes_count: 14, comments_count: 0, created_at: '2026-10-07T10:00:00Z', edited_at: null, ...o });

test('il post del server diventa un post locale con id stabile e negativo', () => {
  const p = toLocalPost(row());
  assert.equal(p.remoteId, 'aaaaaaaa-0000-0000-0000-000000000001'); assert.ok(p.id < 0); assert.equal(p.id, hashId(p.remoteId));
  assert.equal(p.author, 'Nadia P.'); assert.equal(p.likes, 14); assert.equal(p.tag, 'Genitori');
});
test('i file locali non si inviano al server, gli indirizzi sì', () => {
  const r = toInsertRow({ id: 1, author: 'Io', text: 't', media: 'photo', likes: 0, uri: 'file:///a.jpg' }, 'u1', {});
  assert.equal(r.media_url, null);
  const r2 = toInsertRow({ id: 1, author: 'Io', text: 't', media: 'photo', likes: 0, uri: 'file:///a.jpg' }, 'u1', { media: 'https://x/y.jpg' });
  assert.equal(r2.media_url, 'https://x/y.jpg');
});
test('unione: nuovi post aggiunti, mi piace aggiornati, eliminati tolti, locali intatti', () => {
  const local = [{ id: 5, author: 'Io', text: 'solo mio', media: null, likes: 0 }, { id: hashId('r2'), remoteId: 'r2', author: 'A', text: 'vecchio', media: null, likes: 1 }, { id: hashId('r3'), remoteId: 'r3', author: 'B', text: 'x', media: null, likes: 0 }];
  const m = mergeRemote(local, [row({ id: 'r1', body: 'nuovo' }), row({ id: 'r2', body: 'vecchio', likes_count: 9 })], { deletedIds: ['r3'] });
  assert.deepEqual(m.map((p) => p.text), ['nuovo', 'solo mio', 'vecchio']);
  assert.equal(m.find((p) => p.remoteId === 'r2').likes, 9);
});
test('comandi condivisi: solo sicuri e con voti', () => {
  const ok = { id: '1', pattern: 'portami alle palestre', kind: 'page', target: 'fitnessGyms', score: 3 };
  assert.ok(isSafeShared(ok));
  assert.ok(!isSafeShared({ ...ok, score: 1 }));
  assert.ok(!isSafeShared({ ...ok, kind: 'cmd', target: 'invia 500 lifepoints a Marco' }));
  assert.ok(!isSafeShared({ ...ok, kind: 'page', target: 'x; drop' }));
  assert.ok(isSafeShared({ ...ok, kind: 'cmd', pattern: 'segna {n} come task', target: 'add task "{n}"' }));
});
test('prima di condividere: niente email, numeri lunghi o comandi su soldi', () => {
  assert.equal(shareBlock('portami alle palestre', 'page', 'fitnessGyms'), null);
  assert.ok(shareBlock('scrivi a mario@x.it', 'cmd', 'add task x'));
  assert.ok(shareBlock('paga la bolletta', 'cmd', 'paga bolletta'));
  assert.ok(shareBlock('il mio iban 1234567', 'page', 'lifefinance'));
});
