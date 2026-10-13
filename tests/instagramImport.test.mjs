import test from 'node:test';
import assert from 'node:assert/strict';
import { fixMojibake, parseInstagram, wantedJson, resolveEntry } from '../src/lib/instagramImport.ts';

test('fixMojibake sistema il testo di Instagram', () => {
  const broken = Buffer.from('Perché è così', 'utf8').toString('latin1');
  assert.equal(fixMojibake(broken), 'Perché è così');
  assert.equal(fixMojibake('Ciao a tutti'), 'Ciao a tutti');
  assert.equal(fixMojibake('già'), 'già');
});

test('parseInstagram: post, profilo, ordine, doppioni', () => {
  const posts = JSON.stringify([
    { media: [{ uri: 'media/posts/202401/a.jpg', creation_timestamp: 1700000000, title: Buffer.from('Città', 'utf8').toString('latin1') }] },
    { media: [{ uri: 'media/posts/202402/b.jpg', creation_timestamp: 1710000000 }, { uri: 'media/posts/202402/c.mp4', creation_timestamp: 1710000000 }], title: 'Due' },
    { media: [{ uri: 'media/posts/202401/a.jpg', creation_timestamp: 1700000000 }] },
    { media: [{ uri: 'altro.txt' }] },
  ]);
  const info = JSON.stringify({ profile_user: [{ string_map_data: { Name: { value: 'Alex S.' }, Bio: { value: 'corro' }, Username: { value: 'alex' } } }] });
  const r = parseInstagram({ 'your_instagram_activity/media/posts_1.json': posts, 'personal_information/personal_information/personal_information.json': info, 'x/rotto.json': '{' });
  assert.equal(r.posts.length, 2);
  assert.equal(r.posts[0].caption, 'Due');
  assert.equal(r.posts[0].media.length, 2);
  assert.equal(r.posts[1].caption, 'Città');
  assert.deepEqual(r.profile, { name: 'Alex S.', bio: 'corro', username: 'alex' });
});

test('wantedJson e resolveEntry', () => {
  assert.equal(wantedJson('your_instagram_activity/media/posts_1.json'), true);
  assert.equal(wantedJson('personal_information/personal_information/personal_information.json'), true);
  assert.equal(wantedJson('messages/inbox/x/message_1.json'), false);
  assert.equal(resolveEntry(['inst/media/posts/a.jpg'], 'media/posts/a.jpg'), 'inst/media/posts/a.jpg');
  assert.equal(resolveEntry(['a.jpg'], 'b.jpg'), null);
});
