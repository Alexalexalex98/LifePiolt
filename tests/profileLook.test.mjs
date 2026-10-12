import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/profile/look.ts';

test('sanitizeLook: valori sconosciuti scartati, sezioni mancanti in coda', () => {
  const l = L.sanitizeLook({ order: ['grid', 'x', 'stats'], hidden: ['pills', 'nope'], accent: 'rosso', nameSize: 'XL', hiddenPills: ['post', 'zzz'], link: 'a'.repeat(500) });
  assert.deepEqual(l.order.slice(0, 2), ['grid', 'stats']);
  assert.equal(l.order.length, L.SECTION_IDS.length);
  assert.deepEqual(l.hidden, ['pills']);
  assert.equal(l.accent, null);
  assert.equal(l.nameSize, 'M');
  assert.deepEqual(l.hiddenPills, ['post']);
  assert.equal(l.link.length, 120);
});
test('sanitizeLook: input non valido dà i valori di default', () => {
  for (const x of [null, undefined, 5, 'x', []]) assert.deepEqual(L.sanitizeLook(x).order, L.SECTION_IDS);
});
test('moveSection e visibleSections', () => {
  const o = L.moveSection(L.SECTION_IDS, 'grid', -1);
  assert.equal(o[L.SECTION_IDS.length - 2], 'grid');
  assert.deepEqual(L.moveSection(L.SECTION_IDS, 'badges', -1), L.SECTION_IDS);
  assert.equal(L.visibleSections({ ...L.DEFAULT_LOOK, hidden: ['stats'] }).includes('stats'), false);
});
test('safeLink accetta solo http/https', () => {
  assert.equal(L.safeLink('esempio.it'), 'https://esempio.it');
  assert.equal(L.safeLink('javascript:alert(1)'), null);
  assert.equal(L.safeLink('http://a.io/x'), 'http://a.io/x');
  assert.equal(L.safeLink(''), null);
});
