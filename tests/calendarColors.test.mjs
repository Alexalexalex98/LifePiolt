import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, colorOf, colorIdOf, kindOf, tintOf, vacationColor, DEFAULT_COLOR_OF_KIND } from '../src/lib/calendarColors.ts';
import { contrast } from '../src/lib/a11y.ts';
import { palettes } from '../src/constants/theme.ts';

test('tavolozza di 8 colori con id univoci', () => {
  assert.equal(PALETTE.length, 8);
  assert.equal(new Set(PALETTE.map((p) => p.id)).size, 8);
});

test('colori di default per tipo di impegno', () => {
  assert.equal(kindOf({ title: 'Cena' }), 'normal');
  assert.equal(kindOf({ title: 'Cena', important: true }), 'important');
  assert.equal(kindOf({ title: 'Lavoro su: tesi' }), 'work');
  assert.equal(kindOf({ title: 'Fisco: IVA', important: true, ref: 'tax:iva' }), 'tax');
  assert.equal(kindOf({ title: 'Seminario: AI', ref: 'abc' }), 'shared');
  assert.equal(colorIdOf({ title: 'Cena' }), 'blue');
  assert.equal(colorIdOf({ title: 'Cena', important: true }), 'red');
  assert.equal(colorIdOf({ title: 'Lavoro su: x' }), 'violet');
  assert.equal(colorIdOf({ title: 'x', ref: 'tax:1' }), 'amber');
  assert.equal(colorIdOf({ title: 'x', ref: 'inv1' }), 'teal');
  assert.deepEqual(Object.keys(DEFAULT_COLOR_OF_KIND).sort(), ['important', 'normal', 'shared', 'tax', 'work']);
});

test('il colore scelto dall\'utente vince sul default; id sconosciuto torna al default', () => {
  assert.equal(colorIdOf({ title: 'Cena', important: true, color: 'green' }), 'green');
  assert.equal(colorOf({ title: 'Cena', color: 'green' }, 'light'), PALETTE.find((p) => p.id === 'green').light);
  assert.equal(colorIdOf({ title: 'Cena', color: 'fucsia' }), 'blue');
});

test('contrasto grafico >= 3:1 su card in tutti e 4 i temi', () => {
  for (const [name, p] of Object.entries(palettes)) {
    const mode = p.mode;
    for (const c of PALETTE) assert.ok(contrast(c[mode], p.card) >= 3, `${c.id} su ${name}: ${contrast(c[mode], p.card).toFixed(2)}`);
    assert.ok(contrast(vacationColor(mode), p.card) >= 3, `vacanza su ${name}`);
  }
});

test('testo del tema leggibile (>= 4.5:1) sullo sfondo tenue di ogni colore', () => {
  for (const [name, p] of Object.entries(palettes)) {
    for (const c of PALETTE) {
      const bg = tintOf(c[p.mode], p.card);
      assert.ok(contrast(p.text, bg) >= 4.5, `${c.id} su ${name}: ${contrast(p.text, bg).toFixed(2)}`);
    }
  }
});
