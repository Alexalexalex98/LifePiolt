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
