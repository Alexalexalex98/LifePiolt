import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, SHAPES, fits, findFree, nearestFree, addItem, moveItem, resizeItem, removeItem, rowCount, visibleRows, parseShape, shapeKey } from '../src/lib/dash/grid.ts';

test('forme: tutte stanno in 4 colonne e le chiavi tornano', () => {
  for (const s of SHAPES) { assert.ok(s.w >= 1 && s.w <= COLS && s.h >= 1); assert.deepEqual(parseShape(shapeKey(s)), s); }
  assert.equal(SHAPES.length, 12);
});
test('aggiunta: i widget si dispongono senza sovrapporsi', () => {
  let it = [];
  it = addItem(it, 'a', 'x', { w: 2, h: 2 });
  it = addItem(it, 'b', 'x', { w: 2, h: 1 });
  it = addItem(it, 'c', 'x', { w: 4, h: 1 });
  assert.deepEqual(it.map((i) => [i.x, i.y]), [[0, 0], [2, 0], [0, 2]]);
  for (const a of it) assert.ok(fits(it, a, a.id));
});
test('i buchi si riempiono e le forme alte restano a colonna', () => {
  let it = addItem([], 'v', 'x', { w: 1, h: 4 });
  it = addItem(it, 'q', 'x', { w: 3, h: 4 });
  assert.equal(rowCount(it), 4);
  assert.deepEqual(findFree(it, { w: 1, h: 1 }), { x: 0, y: 4 });
});
test('spostamento: nel posto libero più vicino se il punto è occupato', () => {
  let it = [];
  it = addItem(it, 'a', 'x', { w: 2, h: 2 });
  it = addItem(it, 'b', 'x', { w: 2, h: 2 });
  const m = moveItem(it, 'b', 0, 0);
  const b = m.find((i) => i.id === 'b');
  assert.ok(fits(m, b, 'b'));
  assert.notDeepEqual([b.x, b.y], [0, 0]);
  assert.deepEqual(moveItem(it, 'zz', 0, 0), it);
});
test('spostamento: i bordi si rispettano', () => {
  const it = addItem([], 'a', 'x', { w: 3, h: 1 });
  const m = moveItem(it, 'a', 3, 5);
  assert.equal(m[0].x, 1); assert.equal(m[0].y, 5);
});
test('cambio forma: resta dov\'è se c\'è posto, altrimenti si sposta', () => {
  let it = addItem([], 'a', 'x', { w: 1, h: 1 });
  it = addItem(it, 'b', 'x', { w: 1, h: 1 });
  const r = resizeItem(it, 'a', { w: 4, h: 1 });
  const a = r.find((i) => i.id === 'a');
  assert.equal(a.w, 4);
  for (const i of r) assert.ok(fits(r, i, i.id));
});
test('rimozione e righe visibili', () => {
  let it = addItem([], 'a', 'x', { w: 4, h: 3 });
  assert.equal(visibleRows(it), 4);
  it = removeItem(it, 'a');
  assert.equal(rowCount(it), 0); assert.equal(visibleRows(it), 4);
  assert.equal(nearestFree([], { w: 5, h: 1 }, 0, 0), null);
});
