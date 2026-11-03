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
import { mergeItems } from '../src/lib/workspaceCore.ts';
test('unione di modifiche: vince la più recente, le eliminazioni restano', () => {
  const out = mergeItems([{ id: 'a', u: 10, t: 'vecchio' }, { id: 'b', u: 10 }], [{ id: 'a', u: 20, t: 'nuovo' }, { id: 'c', u: 5 }, { id: 'b', u: 30, del: true }]);
  assert.deepEqual(out.map((x) => [x.id, x.t ?? '', !!x.del]), [['a', 'nuovo', false], ['b', '', true], ['c', '', false]]);
  assert.equal(mergeItems([{ id: 'x', u: 5, o: 2 }], [{ id: 'y', u: 1, o: 1 }])[0].id, 'y');
});
