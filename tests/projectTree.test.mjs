import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, childrenOf, driveSubfolders, isDone, parseOutline, pathOf, progressOf, subtreeIds, toOutline } from '../src/lib/projectTree.ts';

const TXT = `# LifePilot
## Fitness
- [x] Allenamento
- [ ] Pasti
  - [x] Foto del piatto
  - [ ] Frigo
## Network
- [ ] Post
`;
const mk = (text) => {
  const { nodes } = buildTree(parseOutline(text).items);
  const out = []; nodes.forEach((n, i) => out.push({ id: `n${i}`, parent: n.parentIndex === null ? null : `n${n.parentIndex}`, title: n.title, done: n.done, files: [], shared: [], createdAt: 0 }));
  return out;
};
test('titoli ed elenchi rientrati diventano un albero a più livelli', () => {
  const t = mk(TXT);
  assert.deepEqual(t.filter((n) => n.parent === null).map((n) => n.title), ['LifePilot']);
  assert.deepEqual(childrenOf(t, 'n0').map((n) => n.title), ['Fitness', 'Network']);
  const pasti = t.find((n) => n.title === 'Pasti');
  assert.deepEqual(childrenOf(t, pasti.id).map((n) => n.title), ['Foto del piatto', 'Frigo']);
  assert.deepEqual(pathOf(t, t.find((n) => n.title === 'Frigo').id), ['LifePilot', 'Fitness', 'Pasti', 'Frigo']);
});
test('il padre si completa solo quando lo sono tutti i figli, la percentuale conta le foglie', () => {
  const t = mk(TXT);
  assert.deepEqual(progressOf(t, 'n0'), { done: 2, total: 4, pct: 50 });
  assert.equal(isDone(t, 'n0'), false);
  t.forEach((n) => { n.done = true; });
  assert.equal(isDone(t, 'n0'), true); assert.equal(progressOf(t, 'n0').pct, 100);
});
test('livelli saltati, tab, numeri, note e righe da ignorare', () => {
  const r = parseOutline('---\ntitolo: x\n---\n- A\n\t- B\n\t\t\t- C salta un livello\n> nota di C\n```\n- dentro il codice\n```\n1. D\n* [X] E\n');
  const { nodes } = buildTree(r.items);
  assert.deepEqual(nodes.map((n) => n.title), ['A', 'B', 'C salta un livello', 'D', 'E']);
  assert.equal(nodes[2].parentIndex, 1); assert.equal(nodes[3].parentIndex, null); assert.equal(nodes[4].done, true);
  assert.match(nodes[2].note, /nota di C/);
});
test('più radici = più progetti; testo semplice senza simboli funziona', () => {
  const t = mk('Casa\n  Cucina\n  Bagno\nLavoro\n  Email');
  assert.deepEqual(t.filter((n) => n.parent === null).map((n) => n.title), ['Casa', 'Lavoro']);
});
test('esporta e reimporta senza perdere niente', () => {
  const t = mk(TXT);
  const again = mk(toOutline(t, 'n0'));
  assert.deepEqual(again.map((n) => [n.title, n.done]), t.map((n) => [n.title, n.done]));
  assert.equal(subtreeIds(t, 'n0').length, t.length);
});
test('limite di voci e cartelle di LifeDrive', () => {
  const big = Array.from({ length: 50 }, (_, i) => `- voce ${i}`).join('\n');
  assert.equal(buildTree(parseOutline(big).items, 10).truncated, true);
  assert.deepEqual(driveSubfolders([['A', 'B'], ['A', 'C', 'D'], ['X']], ['A']), ['B', 'C']);
});

import { readFileSync } from 'node:fs';
import { pdfToText } from '../src/lib/pdfText.ts';
const strip = (s) => s.replace(/^\d+(\.\d+)*\.?\s+/, '').replace(/→/g, '->');
test('il PDF dello stato dell\'app si legge e dà lo stesso albero del file di testo', () => {
  const fromPdf = buildTree(parseOutline(pdfToText(new Uint8Array(readFileSync('docs/STATO-APP.pdf')))).items).nodes;
  const fromMd = buildTree(parseOutline(readFileSync('docs/STATO-APP.md', 'utf8')).items).nodes;
  assert.equal(fromPdf.length, fromMd.length);
  assert.deepEqual(fromPdf.map((n) => [strip(n.title), n.parentIndex, n.done]), fromMd.map((n) => [strip(n.title), n.parentIndex, n.done]));
  assert.equal(fromPdf.filter((n) => n.parentIndex === null).length, 1);
});
test('un file che non è un PDF o non ha testo leggibile dà testo vuoto', () => {
  assert.equal(pdfToText(new TextEncoder().encode('ciao')), '');
  assert.equal(pdfToText(new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n')), '');
});
test('numerazione tipo 1, 1.1, 1.1.1 con righe a capo del PDF', () => {
  const r = buildTree(parseOutline('Progetto\nintroduzione\n1 Casa\n[ ] 1.1 Cucina da pulire\ncon calma\n[x] 1.2 Bagno\n2 Lavoro\n[ ] 2.1 Email\n[ ] 2.1.1 Rispondere').items).nodes;
  assert.deepEqual(r.map((n) => [n.title, n.parentIndex, n.done]), [['Progetto', null, false], ['Casa', 0, false], ['Cucina da pulire con calma', 1, false], ['Bagno', 1, true], ['Lavoro', 0, false], ['Email', 4, false], ['Rispondere', 5, false]]);
});
