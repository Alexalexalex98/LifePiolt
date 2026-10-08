import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, over, failingPairs, parseHex } from '../src/lib/a11y.ts';
import { palettes } from '../src/constants/theme.ts';

test('contrasto: valori noti WCAG', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
  assert.ok(Math.abs(contrast('#767676', '#ffffff') - 4.54) < 0.05);
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
  assert.equal(over('#00000080', '#ffffff'), '#7f7f7f');
});

for (const name of ['dark', 'light', 'darkHC', 'lightHC']) {
  test(`tema ${name}: tutte le coppie testo/sfondo >= 4.5:1`, () => {
    assert.deepEqual(failingPairs(palettes[name]), []);
  });
}

test('alto contrasto: testo secondario e bordi piu forti del tema base', () => {
  for (const [base, hc] of [['dark', 'darkHC'], ['light', 'lightHC']]) {
    assert.ok(contrast(palettes[hc].muted, palettes[hc].bg) > contrast(palettes[base].muted, palettes[base].bg));
    assert.ok(contrast(palettes[hc].border, palettes[hc].bg) >= 3, `bordo ${hc} >= 3:1`);
    assert.ok(contrast(palettes[hc].text, palettes[hc].bg) >= 15);
  }
});

test('le palette hanno le stesse chiavi', () => {
  const k = Object.keys(palettes.dark).sort().join();
  for (const n of Object.keys(palettes)) assert.equal(Object.keys(palettes[n]).sort().join(), k);
});

import { readable } from '../src/lib/a11y.ts';
test('readable: scurisce i pastello su chiaro, schiarisce su scuro, lascia i colori a norma', () => {
  assert.ok(contrast(readable('#7be0b0', '#ffffff'), '#ffffff') >= 4.5);
  assert.ok(contrast(readable('#e0c97b', '#ffffff'), '#ffffff') >= 4.5);
  assert.ok(contrast(readable('#3a2a5c', '#141a24'), '#141a24') >= 4.5);
  assert.equal(readable('#10151d', '#ffffff'), '#10151d');
  assert.equal(readable('nonuncolore', '#ffffff'), 'nonuncolore');
});
