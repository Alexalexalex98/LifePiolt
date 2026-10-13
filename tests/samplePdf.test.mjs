import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSamplePdf, sampleLines } from '../src/lib/samplePdf.ts';

test('PDF di esempio: intestazione, fine file e riferimenti coerenti', () => {
  const b = buildSamplePdf('Contratto di affitto', sampleLines('Contratto di affitto.pdf'));
  const s = Buffer.from(b).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const x = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.equal(s.slice(x, x + 4), 'xref');
  // ogni riferimento punta davvero all'inizio dell'oggetto
  const rows = [...s.slice(x).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  rows.forEach((off, i) => assert.equal(s.slice(off, off + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
});
test('testo con accenti e parentesi non rompe il PDF', () => {
  const s = Buffer.from(buildSamplePdf('Qualità (città) \\ 50%', ['è più (così)'])).toString('latin1');
  assert.ok(s.includes('Qualita \\(citta\\) \\\\ 50%'));
  assert.ok(s.includes('e piu \\(cosi\\)'));
});
test('righe d\'esempio secondo il nome', () => {
  assert.match(sampleLines('Referto analisi sangue.pdf')[0], /Referto/);
  assert.match(sampleLines('Orario.pdf')[0], /Orario/);
});
