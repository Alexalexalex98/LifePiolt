import test from 'node:test';
import assert from 'node:assert/strict';
import { toListing, fromListing, mergeListings, diffMine, authorOf } from '../src/social/listings.ts';

const idea = (o = {}) => ({ id: 5, title: 'App per il quartiere', desc: 'Un\'idea', author: 'Alex', raised: 120, similarTo: null, rewardType: 'libero', fixedAmount: null, rewardDesc: '', target: 500, days: 30, media: 'photo', uri: 'file:///tmp/a.jpg', ...o });
const R = (id, kind, author, o = {}) => ({ id, author_id: 'u-' + author, author_name: author, kind, title: 'T ' + id, body: 'B', payload: {}, audience: 'public', created_at: '2026-11-01T10:00:00Z', ...o });

test('cosa si manda: niente raccolto, id e file locali; i file http restano', () => {
  const l = toListing('idea', idea());
  assert.equal(l.kind, 'idea'); assert.equal(l.title, 'App per il quartiere'); assert.equal(l.body, 'Un\'idea');
  assert.equal('raised' in l.payload, false); assert.equal('id' in l.payload, false); assert.equal('uri' in l.payload, false); assert.equal(l.payload.media, null); assert.equal(l.payload.target, 500);
  assert.equal(toListing('idea', idea({ uri: 'https://x.dev/a.jpg' })).payload.uri, 'https://x.dev/a.jpg');
  const s = toListing('seminar', { id: 2, title: 'Yoga', host: 'Alex', desc: 'd', price: 20, joined: 4, startsAt: 123, audience: 'principianti' });
  assert.deepEqual([s.kind, s.title, 'joined' in s.payload, s.payload.audience, s.payload.price], ['seminar', 'Yoga', false, 'principianti', 20]);
  const v = toListing('service', { name: 'Alex', role: 'Ripetizioni', price: 30, rating: 4.9, tag: 'x', media: null, slots: ['lun 10'] });
  assert.deepEqual([v.kind, v.title, 'rating' in v.payload, v.payload.slots], ['service', 'Alex · Ripetizioni', false, ['lun 10']]);
});
test('da riga del server a elemento locale, con id negativo stabile', () => {
  const a = fromListing(R('11111111-1111-1111-1111-111111111111', 'idea', 'Anna', { payload: { target: 300, rewardType: 'libero' }, audience: 'followers' }));
  assert.equal(a.author, 'Anna'); assert.equal(a.title, 'T 11111111-1111-1111-1111-111111111111'); assert.equal(a.target, 300); assert.equal(a.visibility, 'followers'); assert.equal(a.raised, 0); assert.ok(a.id < 0);
  assert.equal(fromListing(R('11111111-1111-1111-1111-111111111111', 'idea', 'Anna')).id, a.id);
  assert.equal(fromListing(R('s1', 'seminar', 'Anna')).host, 'Anna'); assert.equal(fromListing(R('v1', 'service', 'Anna')).name, 'Anna');
});
test('unione: arrivano quelli degli altri, i miei non si toccano, quelli che il server non mostra più spariscono, gli esempi restano', () => {
  const mine = idea({ remoteId: 'm1', authorId: 'u-Alex' }); const demo = idea({ id: 9, title: 'Esempio', author: 'Marco' });
  const old = idea({ id: -5, title: 'Vecchia', author: 'Anna', remoteId: 'a-old' });
  const out = mergeListings([mine, demo, old], [R('m1', 'idea', 'Alex', { title: 'rinominata altrove' }), R('a1', 'idea', 'Anna', { title: 'Nuova di Anna' }), R('s1', 'seminar', 'Anna')], 'idea', 'Alex');
  assert.deepEqual(out.map((x) => x.title), ['Nuova di Anna', 'App per il quartiere', 'Esempio'], 'la mia non cambia, quella vecchia sparisce, solo le idee entrano');
});
test('unione: un contenuto già presente si aggiorna (e passa al pubblico nuovo)', () => {
  const cur = { ...fromListing(R('a1', 'idea', 'Anna', { title: 'Prima' })), id: -9 };
  const out = mergeListings([cur], [R('a1', 'idea', 'Anna', { title: 'Dopo', audience: 'not_followers' })], 'idea', 'Alex');
  assert.equal(out.length, 1); assert.equal(out[0].title, 'Dopo'); assert.equal(out[0].visibility, 'not_followers');
});
test('cosa pubblicare, aggiornare o togliere (solo i miei)', () => {
  const a = idea({ id: 1, remoteId: 'r1' }), b = idea({ id: 2, title: 'Nuova' }), c = idea({ id: 3, remoteId: 'r3' }), other = idea({ id: 4, author: 'Anna', remoteId: 'ra' });
  const d = diffMine([a, c, other], [{ ...a, title: 'Cambiata' }, b, other], 'idea', 'Alex');
  assert.deepEqual([d.publish.map((x) => x.id), d.update.map((x) => x.id), d.remove], [[2], [1], ['r3']]);
  assert.deepEqual(diffMine([a], [{ ...a, visibility: 'followers' }], 'idea', 'Alex').update.map((x) => x.id), [1], 'cambiare il pubblico aggiorna');
  assert.deepEqual(diffMine([a], [{ ...a, raised: 999 }], 'idea', 'Alex').update, [], 'il raccolto resta locale');
  assert.equal(authorOf('seminar', { host: 'X' }), 'X');
});
