import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ATTACHMENTS, MAX_FILE_BYTES, extOf, docTypeOf, classifyFile, canExtractLocally, truncateText, fmtBytes, admit, rejectSummary,
  looksLikeBill, describeAttachment, textPayload, needsAnalysis, titleFromText, roomFor,
} from '../src/lib/attachments.ts';

test('estensione e tipo documento da nome o mime', () => {
  assert.equal(extOf('Fattura.Maggio.PDF'), 'pdf');
  assert.equal(extOf('senza'), '');
  assert.equal(docTypeOf('a.pdf'), 'pdf');
  assert.equal(docTypeOf('x', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx');
  assert.equal(docTypeOf('conti.xlsx'), 'xlsx');
  assert.equal(docTypeOf('dati.csv'), 'csv');
  assert.equal(docTypeOf('note.md'), 'md');
  assert.equal(docTypeOf('x.zip'), 'zip');
  assert.equal(docTypeOf('x.bin'), 'other');
});
test('classificazione: immagini, video, documenti, eseguibili rifiutati', () => {
  assert.equal(classifyFile('a.HEIC'), 'image');
  assert.equal(classifyFile('x', 'video/mp4'), 'video');
  assert.equal(classifyFile('r.pdf'), 'document');
  assert.equal(classifyFile('setup.apk'), 'unsupported');
  assert.equal(classifyFile('misterioso.bin'), 'unsupported');
  assert.equal(classifyFile('a', 'text/plain'), 'document');
});
test('estrazione locale solo per testo semplice', () => {
  assert.equal(canExtractLocally('a.txt'), true);
  assert.equal(canExtractLocally('a.csv'), true);
  assert.equal(canExtractLocally('a.md'), true);
  assert.equal(canExtractLocally('a.pdf'), false);
  assert.equal(canExtractLocally('a.docx'), false);
  assert.equal(canExtractLocally('a.xlsx'), false);
});
test('troncamento del testo', () => {
  assert.deepEqual(truncateText('ciao\r\nmondo'), { text: 'ciao\nmondo', truncated: false });
  const r = truncateText('x'.repeat(100), 10);
  assert.equal(r.text.length, 10); assert.equal(r.truncated, true);
});
test('dimensioni leggibili', () => {
  assert.equal(fmtBytes(500), '1 kB');
  assert.equal(fmtBytes(2048), '2 kB');
  assert.equal(fmtBytes(1572864), '1.5 MB');
  assert.equal(fmtBytes(20 * 1048576), '20 MB');
  assert.equal(fmtBytes(undefined), '');
  assert.equal(fmtBytes(-1), '');
});
test('limiti: max 6 allegati, 20 MB, tipi non ammessi', () => {
  assert.equal(MAX_ATTACHMENTS, 6);
  const files = [{ name: 'a.pdf', size: 1000 }, { name: 'grosso.pdf', size: MAX_FILE_BYTES + 1 }, { name: 'virus.exe', size: 10 }, { name: 'vuoto.txt', size: 0 }, { name: 'b.docx', size: 5 }];
  const r = admit(0, files);
  assert.deepEqual(r.ok.map((f) => f.name), ['a.pdf', 'b.docx']);
  assert.deepEqual(r.rejected.map((x) => x.reason), ['too_big', 'unsupported', 'empty']);
  assert.match(r.rejected[0].message, /20 MB/);
});
test('limite di numero: quelli oltre il sesto vengono rifiutati', () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 }));
  const r = admit(4, many);
  assert.equal(r.ok.length, 2);
  assert.equal(r.rejected.length, 3);
  assert.ok(r.rejected.every((x) => x.reason === 'limit'));
  assert.equal(rejectSummary(r.rejected), 'Puoi allegare al massimo 6 elementi.');
  assert.equal(roomFor(4), 2); assert.equal(roomFor(9), 0);
  assert.equal(admit(0, [{ name: 'foto', size: 99999999, mime: 'image/jpeg' }], { skipClassify: true }).rejected[0].reason, 'too_big');
});
test('rilevamento bollette e fatture', () => {
  assert.equal(looksLikeBill('Fattura_maggio.pdf'), true);
  assert.equal(looksLikeBill('bolletta-luce-2026.pdf'), true);
  assert.equal(looksLikeBill('invoice 2041.pdf'), true);
  assert.equal(looksLikeBill('foto-vacanza.jpg'), false);
  assert.equal(looksLikeBill('scan.pdf', 'Avviso di pagamento. Scadenza 12/10. Importo 84,20 EUR'), true);
  assert.equal(looksLikeBill('scan.pdf', 'Una sola parola: scadenza'), false);
  assert.equal(looksLikeBill('ricetta.txt', 'farina e uova'), false);
});
test('descrizione e testo per il router', () => {
  const doc = { id: '1', kind: 'document', name: 'c.pdf', size: 2048 };
  const note = { id: '2', kind: 'note', name: 'Spesa', text: 'latte\npane', truncated: true };
  assert.equal(describeAttachment(doc), 'Documento c.pdf (2 kB)');
  assert.equal(describeAttachment({ id: '3', kind: 'contact', name: 'Anna', sub: '+41 79' }), 'Contatto Anna, +41 79');
  assert.equal(textPayload([doc, note]), '--- Spesa ---\nlatte\npane\n[...]');
  assert.equal(needsAnalysis(doc), true);
  assert.equal(needsAnalysis({ ...doc, text: 'abc' }), false);
  assert.equal(needsAnalysis({ id: '4', kind: 'image', name: 'a.jpg' }), true);
  assert.equal(needsAnalysis(note), false);
});
test('titolo da un testo incollato', () => {
  assert.equal(titleFromText('\n\n  Ciao a tutti  \nsecondo'), 'Ciao a tutti');
  assert.equal(titleFromText('x'.repeat(50), 10).length, 10);
  assert.equal(titleFromText('   '), 'Testo');
});
