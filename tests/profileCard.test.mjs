import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/lib/profile/card.ts';
import { qrMatrix, qrPath } from '../src/lib/profile/qr.ts';

test('formato 85x55', () => assert.ok(Math.abs(C.CARD_RATIO - 85 / 55) < 1e-9));
test('ogni modello è valido e ha fronte e retro', () => {
  for (const t of C.TEMPLATES) {
    const d = C.templateDesign(t.id);
    assert.equal(d.template, t.id);
    assert.ok(d.front.els.length > 0 && d.back.els.length > 0, t.id);
    assert.deepEqual(C.sanitizeDesign(JSON.parse(JSON.stringify(d))).front.els.length, d.front.els.length);
  }
  assert.equal(C.templateDesign('inesistente').template, 'classico');
});
test('sanitize: dati corrotti o legacy danno sempre un modello valido', () => {
  for (const raw of [null, 5, 'x', {}, { v: 1 }, { v: 2, front: 3 }]) { const d = C.sanitizeDesign(raw); assert.equal(d.v, 2); assert.ok(d.front.els.length > 0); }
  const d = C.sanitizeDesign({ v: 2, template: 'minimale', front: { bg: { kind: 'solid', c1: 'rosso', c2: '#112233' }, els: [{ t: 'text', text: 'ciao', x: 7, y: -3, size: 999, color: 'nope' }, { t: 'schools', x: 0, y: 0 }, { t: 'field', field: 'schools', x: 0, y: 0 }], strokes: [{ color: '#fff000', width: 99, pts: [[2, -1], [0.5, 0.5]] }, { pts: [] }] }, back: {}, qr: 1 });
  assert.equal(d.front.els.length, 1);
  const e = d.front.els[0];
  assert.equal(e.x, 1); assert.equal(e.y, 0); assert.equal(e.size, 40); assert.equal(e.color, '#111111');
  assert.equal(d.front.bg.c1, templateC1(d)); assert.equal(d.front.bg.c2, '#112233');
  assert.deepEqual(d.front.strokes[0].pts[0], [1, 0]); assert.equal(d.front.strokes[0].width, 24);
  assert.equal(d.front.strokes.length, 1);
  assert.equal(d.qr, true);
});
function templateC1(d) { return C.templateDesign('minimale').front.bg.c1; }
test('contenuto: niente scuole, esperienza, età, indirizzo; contatti solo se condivisi', () => {
  const legacy = { profession: 'Idraulico', showProfession: true, schools: 'Liceo', experience: '10 anni', companyComments: 'ok', residence: 'Via Roma 1', birthYear: 1980, showBirthYear: true, email: 'a@b.ch', phone: '079', showEmail: false, showPhone: true };
  const d = C.buildCardData({ name: 'Anna', legacy, business: 'Rossi SA', skills: ['a', 'b', 'c', 'd', 'e', 'f'], shareEmail: false, sharePhone: true });
  assert.deepEqual(Object.keys(d).sort(), [...C.ALLOWED_KEYS].sort());
  assert.equal(d.role, 'Idraulico'); assert.equal(d.email, ''); assert.equal(d.phone, '079'); assert.equal(d.skills.length, 5);
  assert.ok(!JSON.stringify(d).match(/Liceo|10 anni|Via Roma|1980/));
  assert.equal(C.fieldText('skills', d), 'a · b · c · d · e');
  assert.equal(C.buildCardData({ name: 'A', role: 'Cuoco', legacy, shareEmail: false, sharePhone: false }).role, 'Cuoco');
});
test('tratto -> path SVG', () => {
  assert.equal(C.strokePath([], 100, 50), '');
  assert.match(C.strokePath([[0, 0], [0.5, 0.5], [1, 1]], 100, 50), /^M0 0Q50 25 75 37\.5L100 50$/);
  assert.match(C.strokePath([[0.1, 0.1]], 100, 100), /^M10 10/);
});
test('annulla / ripristina', () => {
  let h = C.hist([]);
  h = C.commit(h, [1]); h = C.commit(h, [1, 2]);
  h = C.undo(h); assert.deepEqual(h.present, [1]);
  h = C.undo(h); assert.deepEqual(h.present, []);
  assert.deepEqual(C.undo(h).present, []);
  h = C.redo(h); assert.deepEqual(h.present, [1]);
  h = C.commit(h, [9]); assert.equal(h.future.length, 0);
});
test('QR: dimensioni, finder e limite', () => {
  const m = qrMatrix('https://lifepilot.app/u/anna');
  assert.equal(m.length, 25);
  assert.ok(m[0][0] && m[0][6] && m[6][0] && m[3][3] && !m[1][1]);
  assert.equal(qrMatrix('x'.repeat(107)), null);
  assert.equal(qrMatrix('x'.repeat(106)).length, 37);
  const p = qrPath(m);
  assert.equal(p.size, 29); assert.ok(p.d.startsWith('M'));
});
test('QR: identico a un codificatore di riferimento (se installato)', async () => {
  let toQR;
  try { ({ toQR } = await import('../node_modules/toqr/dist/toqr.mjs')); } catch { return; }
  for (const s of ['A', 'https://lifepilot.app/u/Alex%20Stefanovic?x=1&y=22222222222222222222', 'x'.repeat(100)]) {
    const a = qrMatrix(s).flat().map(Number); const b = Array.from(toQR(s, 1)).map((v) => (v ? 1 : 0));
    assert.deepEqual(a, b, s.slice(0, 12));
  }
});

test('editor stile Canva: livelli, duplicati, allineamento, scala, rotazione', async () => {
  const c = await import('../src/lib/profile/card.ts');
  const a = { id: 'a', t: 'text', text: 'Ciao', x: 0.1, y: 0.1, size: 12, color: '#111111', font: 'sans' };
  const b = { id: 'b', t: 'shape', shape: 'rect', x: 0, y: 0, w: 0.4, h: 0.1, color: '#6c8cff' };
  const q = { id: 'q', t: 'qr', x: 0.6, y: 0.5, w: 0.2, color: '#111111' };
  assert.deepEqual(c.moveLayer([a, b, q], 'a', 'front').map((e) => e.id), ['b', 'q', 'a']);
  assert.deepEqual(c.moveLayer([a, b, q], 'q', 'back').map((e) => e.id), ['q', 'a', 'b']);
  assert.deepEqual(c.moveLayer([a, b, q], 'b', 'forward').map((e) => e.id), ['a', 'q', 'b']);
  assert.deepEqual(c.moveLayer([a, b, q], 'b', 'backward').map((e) => e.id), ['b', 'a', 'q']);
  const d = c.duplicateEl([a, b], 'b');
  assert.equal(d.els.length, 3); assert.ok(d.id && d.id !== 'b');
  assert.equal(c.duplicateEl([a, q], 'q').id, null);
  assert.ok(Math.abs(c.alignEl(b, 'hcenter').x - 0.3) < 1e-9);
  assert.equal(c.alignEl(b, 'left').x, 0.06);
  assert.ok(Math.abs(c.alignEl(b, 'right').x - 0.54) < 1e-9);
  assert.equal(c.scaleEl(a, 2).size, 24);
  assert.equal(c.scaleEl(a, 10).size, 40);
  const sh = c.scaleEl(b, 0.5); assert.ok(Math.abs(sh.w - 0.2) < 1e-9 && Math.abs(sh.h - 0.05) < 1e-9);
  assert.equal(c.snapRot(87), 90); assert.equal(c.snapRot(-2), 0); assert.equal(c.snapRot(30), 30); assert.equal(c.snapRot(178), -180);
  const clean = c.sanitizeDesign({ v: 2, template: 'minimale', qr: false, back: { bg: { kind: 'solid', c1: '#ffffff', c2: '#ffffff', angle: 0 }, els: [], strokes: [] }, front: { bg: { kind: 'solid', c1: '#ffffff', c2: '#ffffff', angle: 0 }, strokes: [], els: [{ ...a, rot: 400, op: 0.05 }, { ...b, rot: 30, op: 0.5 }] } });
  const es = clean.front.els;
  assert.equal(es[0].rot, 180); assert.equal(es[0].op, 0.1);
  assert.equal(es[1].rot, 30); assert.equal(es[1].op, 0.5);
});
