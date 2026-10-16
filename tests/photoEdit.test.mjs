import test from 'node:test';
import assert from 'node:assert/strict';
import { addAdjust, cropRect, parseEdit, zoomRect } from '../src/lib/photoEdit.ts';

test('ritaglio centrato: quadrato su foto larga e 9:16 su foto larga', () => {
  assert.deepEqual(cropRect(4000, 3000, '1:1'), { originX: 500, originY: 0, width: 3000, height: 3000 });
  const r = cropRect(4000, 3000, '9:16');
  assert.equal(r.height, 3000); assert.equal(r.width, 1688);
  assert.equal(r.originX, Math.round((4000 - 1687.5) / 2));
  const z = cropRect(1000, 1000, '1:1', 2);
  assert.deepEqual(z, { originX: 250, originY: 250, width: 500, height: 500 });
});
test('zoom: sempre dentro la foto', () => {
  assert.deepEqual(zoomRect(1000, 2000, 2), { originX: 250, originY: 500, width: 500, height: 1000 });
  assert.equal(zoomRect(1000, 1000, 99).width, 250);
  assert.equal(zoomRect(1000, 1000, 0.1).width, 1000);
});
test('ritocchi: si sommano e restano nei limiti', () => {
  const a = addAdjust({ bright: 0.9, warm: 0, fade: 0.9, vign: 0 }, { bright: 0.5, fade: 0.5, warm: -0.3 });
  assert.deepEqual(a, { bright: 1, warm: -0.3, fade: 1, vign: 0 });
});
test('richieste scritte: luce e calore, geometria, filtri; cosa non si può fare si dice', () => {
  const p = parseEdit('Rendila più luminosa e calda, in formato quadrato e ruota a sinistra');
  assert.ok(p.ops.some((o) => o.k === 'adj' && o.d.bright > 0));
  assert.ok(p.ops.some((o) => o.k === 'adj' && o.d.warm > 0));
  assert.ok(p.ops.some((o) => o.k === 'crop' && o.ratio === '1:1'));
  assert.ok(p.ops.some((o) => o.k === 'rotate' && o.deg === -90));
  assert.equal(p.unsupported.length, 0);
  assert.ok(parseEdit('più scura').ops.some((o) => o.k === 'adj' && o.d.bright < 0));
  assert.ok(parseEdit('effetto vintage').ops.some((o) => o.k === 'adj' && o.d.fade > 0));
  assert.ok(parseEdit('metti il filtro neon').ops.some((o) => o.k === 'filter' && o.id === 'neon'));
  const u = parseEdit('togli la persona sullo sfondo e fai bianco e nero');
  assert.equal(u.ops.length, 0);
  assert.ok(u.unsupported.length >= 2);
  assert.deepEqual(parseEdit('ciao').ops, []);
});
