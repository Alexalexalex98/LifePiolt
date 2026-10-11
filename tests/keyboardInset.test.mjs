import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKeyboard, restingBottom, sheetMaxHeight, growHeight, shouldScrollToEnd, KB_HIDDEN } from '../src/lib/keyboardInset.ts';

const and = { os: 'android', winW: 400, winH: 900, baseWinH: 900 };
const ios = { os: 'ios', winW: 390, winH: 844, baseWinH: 844 };

test('nessuna tastiera: stato nascosto', () => {
  assert.deepEqual(resolveKeyboard(null, and), KB_HIDDEN);
  assert.deepEqual(resolveKeyboard({ height: 0 }, and), KB_HIDDEN);
  assert.deepEqual(resolveKeyboard({ height: NaN }, and), KB_HIDDEN);
});
test('Android edge-to-edge: la finestra non cambia, si riserva tutta l\'altezza', () => {
  const k = resolveKeyboard({ height: 310, screenY: 590 }, and);
  assert.equal(k.visible, true); assert.equal(k.height, 310); assert.equal(k.resized, false);
});
test('Android con finestra già ridimensionata dal sistema: nessun doppio spazio', () => {
  const k = resolveKeyboard({ height: 310 }, { ...and, winH: 600 });
  assert.equal(k.visible, true); assert.equal(k.height, 0); assert.equal(k.resized, true);
});
test('Android: piccola variazione della finestra (barra di stato) non conta come ridimensionamento', () => {
  assert.equal(resolveKeyboard({ height: 310 }, { ...and, winH: 880 }).height, 310);
});
test('iOS usa screenY quando c\'è (barra suggerimenti inclusa)', () => {
  const k = resolveKeyboard({ height: 336, screenY: 500, width: 390 }, ios);
  assert.equal(k.height, 344);
});
test('iOS: screenY assurdo -> si usa l\'altezza', () => {
  assert.equal(resolveKeyboard({ height: 336, screenY: 5000, width: 390 }, ios).height, 336);
  assert.equal(resolveKeyboard({ height: 336, screenY: 0, width: 390 }, ios).height, 336);
});
test('tastiera fluttuante (iPad): visibile ma senza spazio riservato', () => {
  const k = resolveKeyboard({ height: 260, screenY: 300, width: 320 }, { ...ios, winW: 820, winH: 1180 });
  assert.equal(k.visible, true); assert.equal(k.floating, true); assert.equal(k.height, 0);
});
test('cambio di altezza (suggerimenti/emoji): si ricalcola', () => {
  assert.equal(resolveKeyboard({ height: 280 }, and).height, 280);
  assert.equal(resolveKeyboard({ height: 420 }, and).height, 420);
});
test('restingBottom: area sicura solo a riposo o con tastiera fluttuante', () => {
  assert.equal(restingBottom({ visible: false, floating: false }, 34), 34);
  assert.equal(restingBottom({ visible: true, floating: false }, 34), 0);
  assert.equal(restingBottom({ visible: true, floating: true }, 34), 34);
  assert.equal(restingBottom({ visible: false, floating: false }, -5), 0);
});
test('sheetMaxHeight resta sotto la barra di stato con la tastiera aperta', () => {
  assert.equal(sheetMaxHeight(900, 40, 0), 738);
  assert.equal(sheetMaxHeight(900, 40, 400), 444);
  assert.equal(sheetMaxHeight(300, 40, 280), 160);
});
test('growHeight: da 1 a 5 righe', () => {
  assert.equal(growHeight(10, 22, 20), 42);
  assert.equal(growHeight(64, 22, 20), 84);
  assert.equal(growHeight(500, 22, 20), 130);
  assert.equal(growHeight(NaN, 22, 20), 42);
});
test('shouldScrollToEnd: all\'apertura e al cambio di altezza, non a ogni render', () => {
  const closed = { visible: false, height: 0 }, open = { visible: true, height: 300 };
  assert.equal(shouldScrollToEnd(closed, open), true);
  assert.equal(shouldScrollToEnd(open, open), false);
  assert.equal(shouldScrollToEnd(open, { visible: true, height: 380 }), true);
  assert.equal(shouldScrollToEnd(open, closed), false);
});
