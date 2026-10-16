import test from 'node:test';
import assert from 'node:assert/strict';
import { isDoubleTap, onPageRefresh, triggerPageRefresh } from '../src/lib/pageRefresh.ts';

test('doppio tocco: entro 350 ms, non al primo tocco', () => {
  assert.equal(isDoubleTap(0, 1000), false);
  assert.equal(isDoubleTap(1000, 1200), true);
  assert.equal(isDoubleTap(1000, 1500), false);
});
test('aggiornamento pagina: chiama chi è iscritto, index vale home, dopo la disiscrizione no', () => {
  let n = 0;
  const off = onPageRefresh('index', () => { n++; });
  assert.equal(triggerPageRefresh('home'), true);
  assert.equal(n, 1);
  off();
  assert.equal(triggerPageRefresh('home'), false);
});
