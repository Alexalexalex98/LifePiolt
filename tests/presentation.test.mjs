import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOfFile, presentHelp, clampPage, pdfHtml, extOf } from '../src/lib/presentation.ts';

test('tipo di file da nome e mime', () => {
  assert.equal(kindOfFile('Bilancio.PDF'), 'pdf');
  assert.equal(kindOfFile('x', 'application/pdf'), 'pdf');
  assert.equal(kindOfFile('foto.HEIC'), 'image');
  assert.equal(kindOfFile('a', 'image/png'), 'image');
  assert.equal(kindOfFile('Lezione.pptx'), 'slides');
  assert.equal(kindOfFile('Lezione.key'), 'slides');
  assert.equal(kindOfFile('dati.xlsx'), 'other');
  assert.equal(extOf('senza'), '');
});
test('aiuto solo per ciò che non si mostra direttamente', () => {
  assert.match(presentHelp('slides'), /PDF/);
  assert.ok(presentHelp('other'));
  assert.equal(presentHelp('pdf'), null);
  assert.equal(presentHelp('image'), null);
});
test('pagina corrente sempre valida', () => {
  assert.equal(clampPage(0, 10), 1);
  assert.equal(clampPage(99, 10), 10);
  assert.equal(clampPage(NaN, 10), 1);
  assert.equal(clampPage(3.4, 10), 3);
});
test('html del PDF contiene i dati e pdf.js', () => {
  const h = pdfHtml('QUJD');
  assert.match(h, /atob\('QUJD'\)/);
  assert.match(h, /pdf\.min\.js/);
  assert.match(pdfHtml('QUJD', { dark: false }), /#e9edf3/);
});
