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

test('la giornata: parti del giorno, durata, momenti fissi, regali', async () => {
  const m = await import('../src/lib/stories.ts');
  const at = (h, min = 0) => new Date(2026, 9, 13, h, min).getTime();
  assert.equal(m.partOf(at(7)), 'Mattina'); assert.equal(m.partOf(at(12)), 'Pomeriggio'); assert.equal(m.partOf(at(19)), 'Sera'); assert.equal(m.partOf(at(2)), 'Notte');
  assert.equal(m.timeLabel(at(7, 5)), '07:05');
  const mk = (id, ts, extra = {}) => ({ id, author: 'A', ts, kind: 'text', text: 'x', views: [], ...extra });
  const parts = m.dayParts([mk('c', at(19)), mk('a', at(7)), mk('b', at(8)), mk('z', at(9), { keep: 'moment' })]);
  assert.deepEqual(parts.map((p) => p.part), ['Mattina', 'Sera']);
  assert.deepEqual(parts[0].stories.map((s) => s.id), ['a', 'b']);
  assert.deepEqual(m.fixedMoments([mk('z', 1, { keep: 'moment' }), mk('y', 5, { keep: 'moment' }), mk('n', 9)]).map((s) => s.id), ['y', 'z']);
  const now = at(12);
  assert.equal(m.isActive(mk('w', now - 3 * 86400000, { keep: 'week' }), now), true);
  assert.equal(m.isActive(mk('d', now - 3 * 86400000), now), false);
  assert.equal(m.isActive(mk('f', now - 400 * 86400000, { keep: 'moment' }), now), true);
  const g = m.addGift(m.addGift([mk('a', 1)], 'a', 'B'), 'a', 'B');
  assert.deepEqual(g[0].gifts, ['B']);
  assert.equal(m.addGift([mk('a', 1)], 'a', 'A')[0].gifts, undefined);
  const s = m.makeStory({ id: '1', author: 'A', now, kind: 'text', text: 'ciao', keep: 'week', attach: { kind: 'event', label: ' Corsa alle 7 ', ref: '2026-10-14' } });
  assert.equal(s.keep, 'week'); assert.equal(s.attach.label, 'Corsa alle 7');
});

test('filtri e posizione del testo', async () => {
  const m = await import('../src/lib/stories.ts');
  assert.equal(m.tintOfFilter('none'), null); assert.ok(m.tintOfFilter('caldo')); assert.equal(m.tintOfFilter('boh'), null);
  const s = m.makeStory({ id: '1', author: 'A', now: 5, kind: 'photo', uri: 'u', filter: 'neon', textPos: 'alto', textColor: '#FFD166', text: 'ciao' });
  assert.equal(s.filter, 'neon'); assert.equal(s.textPos, 'alto'); assert.equal(s.textColor, '#FFD166');
  const d = m.makeStory({ id: '2', author: 'A', now: 5, kind: 'photo', uri: 'u', filter: 'none', textPos: 'basso', textColor: 'rosso' });
  assert.equal(d.filter, undefined); assert.equal(d.textPos, undefined); assert.equal(d.textColor, undefined);
});
