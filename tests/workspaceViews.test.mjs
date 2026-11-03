import test from 'node:test';
import assert from 'node:assert/strict';
import { applyView, byDay, parseDate, parseTaskLines, TEMPLATES } from '../src/lib/workspaceViews.ts';

const cols = [{ id: 'a', name: 'Nome', kind: 'text' }, { id: 'n', name: 'N', kind: 'number' }, { id: 'd', name: 'Data', kind: 'date' }];
const rows = [{ id: '1', cells: { a: 'Zeta', n: '10', d: '05/03/2026' } }, { id: '2', cells: { a: 'alfa', n: '2', d: '01/03/2026' } }, { id: '3', cells: { a: 'Beta', n: '7' } }];
test('date', () => { assert.equal(parseDate('x'), null); assert.equal(parseDate('05/03/2026'), new Date(2026, 2, 5).getTime()); });
test('ordina numeri e date', () => {
  assert.deepEqual(applyView(cols, rows, null, { col: 'n', dir: 1 }).map((r) => r.id), ['2', '3', '1']);
  assert.deepEqual(applyView(cols, rows, null, { col: 'd', dir: 1 }).map((r) => r.id), ['2', '1', '3']);
  assert.deepEqual(applyView(cols, rows, null, { col: 'a', dir: 1 }).map((r) => r.id), ['2', '3', '1']);
});
test('filtra', () => {
  assert.deepEqual(applyView(cols, rows, { col: 'a', op: 'has', v: 'ET' }).map((r) => r.id), ['1', '3']);
  assert.deepEqual(applyView(cols, rows, { col: 'n', op: 'gt', v: '5' }).map((r) => r.id), ['1', '3']);
  assert.deepEqual(applyView(cols, rows, { col: 'a', op: 'not', v: 'alfa' }).map((r) => r.id), ['1', '3']);
  assert.equal(applyView(cols, rows, { col: 'a', op: 'has', v: '' }).length, 3);
});
test('calendario', () => { const r = byDay(cols, rows); assert.equal(r.days.length, 2); assert.equal(r.undated.length, 1); assert.equal(r.days[0].rows[0].id, '2'); });
test('task dall\'AI', () => {
  const r = parseTaskLines('Ecco i task:\n- Chiamare Anna | 12/03\n2. Preparare slide\n* **Inviare offerta** | venerdì');
  assert.deepEqual(r.map((x) => x.title), ['Chiamare Anna', 'Preparare slide', 'Inviare offerta']);
  assert.equal(r[0].date, '12/03');
});
test('template', () => { assert.ok(TEMPLATES.length >= 6); TEMPLATES.forEach((t) => assert.ok(t.kind === 'db' ? t.cols?.length : t.blocks?.length)); });
