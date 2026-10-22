import test from 'node:test';
import assert from 'node:assert/strict';
import { mix, toHex, parseHex, bodyTones, EXPRESSIONS } from '../src/lib/mascot.ts';

test('colori: esadecimale, mescolanza ai due estremi e a metà', () => {
  assert.deepEqual(parseHex('#ff8000'), [255, 128, 0]); assert.equal(toHex([255, 128, 0]), '#ff8000');
  assert.equal(mix('#000000', '#ffffff', 0), '#000000'); assert.equal(mix('#000000', '#ffffff', 1), '#ffffff'); assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});
test('le tinte del corpo: la luce è più chiara della base, l\'ombra più scura; occhi scuri', () => {
  const t = bodyTones('#6c8cff');
  const lum = (h) => { const [r, g, b] = parseHex(h); return r + g + b; };
  assert.ok(lum(t.light) > lum(t.base) && lum(t.base) > lum(t.shade) && lum(t.eye) < lum(t.shade));
});
test('dieci espressioni, tutte diverse', () => { assert.equal(EXPRESSIONS.length, 10); assert.equal(new Set(EXPRESSIONS.map((e) => e.id)).size, 10); });
