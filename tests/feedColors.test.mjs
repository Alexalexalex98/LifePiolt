import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, over } from '../src/lib/a11y.ts';
import { DARK_PALETTES, LIGHT_PALETTES, paletteFor, heroPaletteFor, seedHash, textCardFontSize, artShapes, GLOW_PEAK_MAX } from '../src/components/feed/feedColors.ts';

const mix = (a, b) => '#' + [1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');

for (const [name, list] of [['scuro', DARK_PALETTES], ['chiaro', LIGHT_PALETTES]]) {
  test(`carta tipografica ${name}: testo e sottotesto >= 4.5:1 su inizio, meta e fine del gradiente`, () => {
    for (const p of list) {
      for (const bg of [p.from, p.to, mix(p.from, p.to)]) {
        assert.ok(contrast(p.text, bg) >= 4.5, `${p.name} text su ${bg}: ${contrast(p.text, bg)}`);
        assert.ok(contrast(p.sub, bg) >= 4.5, `${p.name} sub su ${bg}: ${contrast(p.sub, bg)}`);
      }
    }
  });
}

test('aloni decorativi: anche con due aloni sovrapposti il testo resta >= 4.5:1 (scuro: aloni bianchi sullo sfondo)', () => {
  const glow = '#ffffff' + Math.round(GLOW_PEAK_MAX * 2 * 255).toString(16).padStart(2, '0');
  for (const p of DARK_PALETTES) for (const bg of [p.from, p.to, mix(p.from, p.to)]) {
    assert.ok(contrast(p.text, over(glow, bg)) >= 4.5, `${p.name} testo su ${bg} con alone`);
    assert.ok(contrast(p.sub, over(glow, bg)) >= 4.5, `${p.name} sub su ${bg} con alone`);
  }
  for (let i = 0; i < 100; i++) for (const sh of artShapes('s' + i)) assert.ok(sh.o <= GLOW_PEAK_MAX + 1e-9);
});

test('alto contrasto: testo puro e contrasto >= 7:1', () => {
  for (const tone of ['dark', 'light']) {
    for (let i = 0; i < 60; i++) {
      const p = paletteFor('seed' + i, tone, true);
      assert.ok(contrast(p.text, p.from) >= 7 && contrast(p.text, p.to) >= 7, `${tone} ${p.name}`);
    }
  }
});

test('palette deterministica e ben distribuita', () => {
  assert.deepEqual(paletteFor('Giulia M.1', 'dark'), paletteFor('Giulia M.1', 'dark'));
  const used = new Set(Array.from({ length: 200 }, (_, i) => paletteFor('x' + i, 'dark').name));
  assert.equal(used.size, DARK_PALETTES.length);
  assert.equal(heroPaletteFor('AURA').text, '#ffffff');
  assert.equal(seedHash('a'), seedHash('a'));
});

test('dimensione del testo cala con la lunghezza', () => {
  const sizes = [10, 60, 100, 200, 400].map(textCardFontSize);
  assert.deepEqual([...sizes].sort((a, b) => b - a), sizes);
  assert.ok(sizes[0] > sizes[4]);
});

test('forme dei segnaposto in 0..1 e stabili', () => {
  const a = artShapes('foto');
  assert.deepEqual(a, artShapes('foto'));
  for (const s of a) assert.ok(s.cx >= 0 && s.cx <= 1 && s.cy >= 0 && s.cy <= 1 && s.r > 0 && s.o > 0 && s.o < 0.3);
});
