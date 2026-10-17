import test from 'node:test';
import assert from 'node:assert/strict';
import { palettes } from '../src/constants/theme.ts';
import { contrast } from '../src/lib/a11y.ts';
import { ACCENTS, TONES, customize, isHex, normHex } from '../src/lib/themeCustom.ts';

test('personalizzazione: ogni accento resta leggibile sullo sfondo, scuro e chiaro, con ogni tono', () => {
  for (const base of [palettes.dark, palettes.light]) for (const tone of TONES) for (const a of ACCENTS) {
    const p = customize(base, { accent: a.hex, tone: tone.id });
    assert.ok(contrast(p.accent, p.bg) >= 4.5, `${a.id}/${tone.id}/${base.mode}: ${contrast(p.accent, p.bg).toFixed(2)}`);
    assert.ok(contrast(p.onAccent, p.accent) >= 4.5, `testo sul pulsante ${a.id}/${base.mode}`);
    assert.ok(contrast(p.text, p.bg) >= 7, `testo ${tone.id}/${base.mode}`);
    assert.ok(contrast(p.muted, p.card) >= 4.5, `testo secondario ${tone.id}/${base.mode}`);
  }
});
test('senza scelte non cambia nulla; l\'alto contrasto tiene lo sfondo', () => {
  assert.equal(customize(palettes.dark, undefined), palettes.dark);
  assert.equal(customize(palettes.dark, {}), palettes.dark);
  assert.equal(customize(palettes.darkHC, { tone: 'vino' }, true).bg, '#000000');
  assert.notEqual(customize(palettes.dark, { tone: 'bosco' }).bg, palettes.dark.bg);
  assert.equal(customize(palettes.light, { tone: 'bosco' }).mode, 'light');
});
test('codici colore', () => {
  assert.ok(isHex('#a1B2c3') && isHex('a1b2c3'));
  assert.ok(!isHex('#abc') && !isHex('rosso'));
  assert.equal(normHex(' A1B2C3 '), '#a1b2c3');
});
