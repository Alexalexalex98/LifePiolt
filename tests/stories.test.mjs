import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_MS, activeStories, storyGroups, startIndex, addView, ago, makeStory } from '../src/lib/stories.ts';

const NOW = 1_800_000_000_000;
const S = (id, author, minAgo, extra = {}) => ({ id, author, ts: NOW - minAgo * 60000, kind: 'text', text: 'x', views: [], ...extra });

test('le storie durano 24 ore', () => {
  const all = [S('a', 'Anna', 10), S('b', 'Anna', 24 * 60 + 1), S('c', 'Anna', -0.5), S('d', 'Anna', -5)];
  assert.deepEqual(activeStories(all, NOW).map((s) => s.id), ['a', 'c']);
  assert.equal(STORY_MS, 86400000);
});
test('gruppi: le mie per prime, poi non viste, poi viste; solo di chi posso vedere', () => {
  const all = [S('m1', 'Io', 30), S('a1', 'Anna', 50), S('b1', 'Bea', 20), S('b2', 'Bea', 10), S('c1', 'Carlo', 5), S('x1', 'Estranea', 5)];
  const g = storyGroups(all, 'Io', (n) => n !== 'Estranea', ['a1'], NOW);
  assert.deepEqual(g.map((x) => x.author), ['Io', 'Carlo', 'Bea', 'Anna']);
  assert.equal(g[0].unseen, 0);
  assert.equal(g[2].unseen, 2);
  assert.equal(g[3].unseen, 0);
});
test('da dove si parte e visualizzazioni', () => {
  const all = [S('b1', 'Bea', 20), S('b2', 'Bea', 10)];
  const [g] = storyGroups(all, 'Io', () => true, ['b1'], NOW);
  assert.equal(startIndex(g, ['b1']), 1);
  assert.equal(startIndex(g, ['b1', 'b2']), 0);
  const v = addView(addView(all, 'b1', 'Io'), 'b1', 'Io');
  assert.deepEqual(v[0].views, ['Io']);
  assert.deepEqual(addView(all, 'b1', 'Bea')[0].views, []);
});
test('ago e creazione', () => {
  assert.equal(ago(NOW - 20000, NOW), 'adesso'); assert.equal(ago(NOW - 5 * 60000, NOW), '5 min'); assert.equal(ago(NOW - 150 * 60000, NOW), '2 h');
  assert.equal(makeStory({ id: '1', author: 'Io', now: NOW, kind: 'text', text: '   ' }), null);
  assert.equal(makeStory({ id: '1', author: 'Io', now: NOW, kind: 'photo' }), null);
  assert.equal(makeStory({ id: '1', author: 'Io', now: NOW, kind: 'text', text: 'a'.repeat(300) }).text.length, 140);
  assert.equal(makeStory({ id: '1', author: 'Io', now: NOW, kind: 'photo', uri: 'u' }).uri, 'u');
});
