import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSpec, parseBuilderReply, MAX_BLOCKS } from '../src/lib/creative/spec.ts';

test('cleanSpec scarta tipi sconosciuti e limita dimensioni', () => {
  const s = cleanSpec({ title: 'Diario', blocks: [{ t: 'heading', text: 'Oggi' }, { t: 'script', text: 'alert(1)' }, { t: 'progress', label: 'Acqua', pct: 250 }, { t: 'list', items: ['a', '', 'b'] }, { t: 'button', label: 'Vai' }] });
  assert.deepEqual(s.blocks.map((b) => b.t), ['heading', 'progress', 'list', 'button']);
  assert.equal(s.blocks[1].pct, 100);
  assert.deepEqual(s.blocks[2].items, ['a', 'b']);
  assert.equal(s.blocks[3].message, 'Vai');
});
test('cleanSpec: troppi blocchi e input non valido', () => {
  const many = cleanSpec({ title: 'x', blocks: Array.from({ length: 200 }, () => ({ t: 'divider' })) });
  assert.equal(many.blocks.length, MAX_BLOCKS);
  assert.equal(cleanSpec(null), null); assert.equal(cleanSpec({ blocks: [] }), null);
});
test('parseBuilderReply estrae la scheda e toglie il marcatore', () => {
  const r = parseBuilderReply('Ecco una prima idea. [[SCHEDA {"title":"Abitudini","blocks":[{"t":"stat","label":"Serie","value":"7 giorni"}]}]]');
  assert.equal(r.text, 'Ecco una prima idea.'); assert.equal(r.spec.title, 'Abitudini'); assert.equal(r.spec.blocks[0].value, '7 giorni');
  assert.equal(parseBuilderReply('Solo testo').spec, null);
  assert.equal(parseBuilderReply('[[SCHEDA {rotto]]').spec, null);
});
