import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, resolveBg } from '../src/lib/dash/backgrounds.ts';

test('sfondi pronti: id unici, almeno due colori, colori validi', () => {
  assert.ok(PRESETS.length >= 12);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) { assert.ok(p.colors.length >= 2, p.id); for (const c of p.colors) assert.match(c, /^#[0-9a-f]{6}$/i); }
});
test('sfondo: una sola immagine, mai più copie', () => {
  assert.deepEqual(resolveBg({ kind: 'photo', photo: 'file:///a.jpg' }), { kind: 'photo', uri: 'file:///a.jpg' });
  assert.equal(resolveBg({ kind: 'preset', preset: 'aurora' }).kind, 'preset');
});
test('sfondo: dati mancanti o vecchi tornano allo sfondo normale o alla prima foto di prima', () => {
  assert.equal(resolveBg(undefined).kind, 'none');
  assert.equal(resolveBg({ kind: 'photo' }).kind, 'none');
  assert.equal(resolveBg({ kind: 'preset', preset: 'inesistente' }).kind, 'none');
  assert.deepEqual(resolveBg({ kind: 'none' }, 'file:///vecchia.jpg'), { kind: 'photo', uri: 'file:///vecchia.jpg' });
});
