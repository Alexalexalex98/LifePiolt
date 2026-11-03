import test from 'node:test';
import assert from 'node:assert/strict';
import { slashCommand, pageText, descendants, pathOf, childrenOf } from '../src/lib/workspaceCore.ts';
test('comandi slash', () => {
  assert.deepEqual(slashCommand('/titolo Piano 2027'), { t: 'h', rest: 'Piano 2027' });
  assert.deepEqual(slashCommand('/todo chiamare Anna'), { t: 'todo', rest: 'chiamare Anna' });
  assert.equal(slashCommand('/linea').t, 'divider'); assert.equal(slashCommand('ciao'), null); assert.equal(slashCommand('/altro cosa'), null);
});
test('pagine annidate: figli, discendenti, percorso', () => {
  const mk = (id, parent) => ({ id, parent, title: id, kind: 'page', blocks: [], comments: [], files: [], updatedAt: Number(id.length) });
  const pages = [mk('a', null), mk('b', 'a'), mk('cc', 'b'), mk('d', null)];
  assert.deepEqual(descendants(pages, 'a').sort(), ['b', 'cc']); assert.deepEqual(pathOf(pages, 'cc').map((p) => p.id), ['a', 'b', 'cc']); assert.deepEqual(childrenOf(pages, null).map((p) => p.id), ['a', 'd']);
});
test('testo di una pagina database', () => {
  const p = { id: 'x', parent: null, title: 'Clienti', kind: 'db', blocks: [], cols: [{ id: 'c1', name: 'Nome', kind: 'text' }, { id: 'c2', name: 'Stato', kind: 'status' }], rows: [{ id: 'r', cells: { c1: 'Rossi SA', c2: 'In corso' } }], comments: [{ id: 'k', ts: 1, text: 'sentire lunedì' }], files: [], updatedAt: 1 };
  assert.equal(pageText(p), 'Clienti\nNome | Stato\nRossi SA | In corso\nCommento: sentire lunedì');
});
