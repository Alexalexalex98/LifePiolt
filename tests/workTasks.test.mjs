import test from 'node:test';
import assert from 'node:assert/strict';
import { progress, waitingOn, lateTasks, sortTasks, groupByStatus, nextDue, lateDigest, fromTemplate, PROJECT_TEMPLATES, subtasksOf } from '../src/lib/workTasks.ts';

const T = (id, o = {}) => ({ id, team_id: 't', project: 'p', title: id, notes: '', assignee: null, priority: 'normal', status: 'todo', due: null, est_min: null, parent: null, depends_on: [], recurrence: 'none', block_reason: '', created_by: 'u', ...o });
test('avanzamento: sottotask e task semplici', () => {
  assert.equal(progress([]), 0);
  assert.equal(progress([T('a', { status: 'done' }), T('b')]), 50);
  const all = [T('a'), T('a1', { parent: 'a', status: 'done' }), T('a2', { parent: 'a' }), T('b', { status: 'done' })];
  assert.equal(progress(all), 75); assert.equal(subtasksOf(all[0], all).length, 2);
});
test('dipendenze e ritardi', () => {
  const all = [T('a'), T('b', { depends_on: ['a'] }), T('c', { depends_on: ['a'], status: 'done' })];
  assert.deepEqual(waitingOn(all[1], all).map((x) => x.id), ['a']);
  const all2 = [T('a', { status: 'done' }), T('b', { depends_on: ['a'] })]; assert.equal(waitingOn(all2[1], all2).length, 0);
  assert.deepEqual(lateTasks([T('x', { due: '2026-11-01' }), T('y', { due: '2026-11-09' }), T('z', { due: '2026-10-01', status: 'done' })], '2026-11-05').map((t) => t.id), ['x']);
});
test('ordine: urgenti prima, poi scadenza', () => {
  const s = sortTasks([T('a', { due: '2026-11-10' }), T('b', { priority: 'urgent', due: '2026-12-01' }), T('c', { due: '2026-11-06' })]);
  assert.deepEqual(s.map((t) => t.id), ['b', 'c', 'a']);
  const g = groupByStatus([T('a'), T('b', { status: 'done' }), T('c', { parent: 'a' })]); assert.equal(g.todo.length, 1); assert.equal(g.done.length, 1);
});
test('ripetizioni', () => {
  assert.equal(nextDue('2026-11-10', 'weekly', '2026-11-05'), '2026-11-17');
  assert.equal(nextDue('2026-11-01', 'daily', '2026-11-05'), '2026-11-06');
  assert.equal(nextDue('2026-01-31', 'monthly', '2026-01-20'), '2026-02-28');
  assert.equal(nextDue('2026-11-10', 'none', '2026-11-05'), null);
});
test('messaggio ai ritardatari e modelli', () => {
  const d = lateDigest([T('Report', { due: '2026-11-01', assignee: 'u2' })], '2026-11-05', () => 'Giulia Verdi');
  assert.match(d.text, /@Giulia/); assert.deepEqual(d.mentions, ['u2']); assert.equal(lateDigest([], '2026-11-05', () => ''), null);
  assert.ok(PROJECT_TEMPLATES.length >= 6);
  assert.equal(fromTemplate(PROJECT_TEMPLATES[0], '2026-11-02')[0].due, '2026-11-05');
});
