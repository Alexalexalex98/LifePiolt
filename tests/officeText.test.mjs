import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { officeText } from '../src/lib/officeText.ts';

test('xlsx: fogli, stringhe condivise, numeri e celle vuote', () => {
  const zip = zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Spese" sheetId="1"/><sheet name="Note" sheetId="2"/></sheets></workbook>'),
    'xl/sharedStrings.xml': strToU8('<sst><si><t>Voce</t></si><si><t>Importo</t></si><si><t>Affitto &amp; luce</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>1250.5</v></c></row></sheetData></worksheet>'),
    'xl/worksheets/sheet2.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Ciao</t></is></c></row></sheetData></worksheet>'),
  });
  const t = officeText(zip, 'xlsx');
  assert.match(t, /## Spese\nVoce \| Importo\nAffitto & luce \|  \| 1250\.5/);
  assert.match(t, /## Note\nCiao/);
});
test('pptx: diapositive in ordine con note', () => {
  const zip = zipSync({
    'ppt/slides/slide2.xml': strToU8('<p:sld><a:p><a:r><a:t>Secondo</a:t></a:r></a:p></p:sld>'),
    'ppt/slides/slide1.xml': strToU8('<p:sld><a:p><a:r><a:t>Titolo </a:t></a:r><a:r><a:t>grande</a:t></a:r></a:p><a:p><a:r><a:t>Punto uno</a:t></a:r></a:p></p:sld>'),
    'ppt/notesSlides/notesSlide1.xml': strToU8('<p:notes><a:t>ricorda i numeri</a:t></p:notes>'),
  });
  const t = officeText(zip, 'pptx');
  assert.match(t, /## Diapositiva 1\nTitolo grande\nPunto uno\n\(Note: ricorda i numeri\)\n\n## Diapositiva 2\nSecondo/);
});
test('docx e file non validi', () => {
  const zip = zipSync({ 'word/document.xml': strToU8('<w:document><w:p><w:r><w:t>Prima riga</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Seconda </w:t></w:r><w:r><w:t>riga</w:t></w:r></w:p></w:document>') });
  assert.equal(officeText(zip, 'docx'), 'Prima riga\nSeconda riga');
  assert.equal(officeText(new Uint8Array([1, 2, 3]), 'xlsx'), null);
});
