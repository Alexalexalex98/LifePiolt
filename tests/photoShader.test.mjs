import test from 'node:test';
import assert from 'node:assert/strict';
import { SKSL, UNIFORM_ORDER, uniformValues, DEFAULTS, LOOKS, AUTO, GROUPS, cleanParams, clampParam, isEdited, diffParams, GEO0, geoMatrix, applyAffine, outputSize, turned } from '../src/lib/photoShader.ts';

test('lo shader dichiara esattamente i valori che gli passiamo, nello stesso ordine', () => {
  const decl = [...SKSL.matchAll(/uniform float (\w+);/g)].map((m) => m[1]);
  assert.deepEqual(decl, UNIFORM_ORDER);
  assert.equal(uniformValues(DEFAULTS, 100, 200).length, decl.length);
  assert.ok(/uniform shader image;/.test(SKSL));
});
test('parentesi dello shader bilanciate e un solo main', () => {
  const o = (s) => (SKSL.match(new RegExp('\\' + s, 'g')) ?? []).length;
  assert.equal(o('{'), o('}')); assert.equal(o('('), o(')'));
  assert.equal((SKSL.match(/half4 main\(/g) ?? []).length, 1);
});
test('valori normalizzati: -100..100 diventa -1..1 e i colori 0..1', () => {
  const v = uniformValues({ ...DEFAULTS, exposure: 50, shHue: 180 }, 10, 20);
  assert.equal(v[UNIFORM_ORDER.indexOf('exposure')], 0.5);
  assert.equal(v[UNIFORM_ORDER.indexOf('shHue')], 0.5);
  assert.equal(v[0], 10); assert.equal(v[1], 20);
});
test('almeno venti controlli, look e «Migliora» validi', () => {
  const n = GROUPS.reduce((a, g) => a + g.controls.length, 0) + 8 + 4;
  assert.ok(n >= 20, String(n));
  for (const l of LOOKS) { const p = cleanParams(l.p); assert.equal(JSON.stringify(Object.keys(p)), JSON.stringify(Object.keys(DEFAULTS))); }
  assert.ok(isEdited(cleanParams(AUTO))); assert.ok(!isEdited(DEFAULTS));
  assert.equal(clampParam('exposure', 900), 100); assert.equal(clampParam('mono', -5), 0);
  assert.deepEqual(diffParams({ ...DEFAULTS, contrast: 10 }), { contrast: 10 });
});
test('geometria: il centro resta al centro, senza bordi vuoti e con 90° gli assi si scambiano', () => {
  const iw = 400, ih = 300;
  const m = applyAffine(geoMatrix(iw, ih, GEO0, 400, 300), iw / 2, ih / 2);
  assert.ok(Math.abs(m.x - 200) < 1e-6 && Math.abs(m.y - 150) < 1e-6);
  const g = { ...GEO0, rot90: 1 };
  assert.deepEqual(turned(iw, ih, g), { w: 300, h: 400 });
  const o = outputSize(iw, ih, { ...GEO0, ratio: '1:1' }, 2000);
  assert.equal(o.w, 300); assert.equal(o.h, 300);
  // con raddrizzamento l'immagine copre ancora tutta l'uscita (i quattro angoli dell'uscita cadono dentro la foto)
  const ga = { ...GEO0, angle: 12 }; const mm = geoMatrix(iw, ih, ga, 400, 300);
  const inv = (x, y) => { const det = mm.a * mm.d - mm.b * mm.c; const dx = x - mm.e, dy = y - mm.f; return { x: (mm.d * dx - mm.c * dy) / det, y: (-mm.b * dx + mm.a * dy) / det }; };
  for (const [x, y] of [[0, 0], [400, 0], [0, 300], [400, 300]]) { const p = inv(x, y); assert.ok(p.x >= -0.5 && p.x <= iw + 0.5 && p.y >= -0.5 && p.y <= ih + 0.5, `${x},${y} -> ${p.x},${p.y}`); }
});
