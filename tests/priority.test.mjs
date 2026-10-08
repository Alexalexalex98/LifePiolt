import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTasks, linked, nextActionText } from '../src/lib/priority.ts';

const NOW = new Date(2026, 9, 7, 10, 0);
const T = (id, t, x = {}) => ({ id, t, ...x });

test('senza urgenze resta l\'ordine dell\'utente', () => {
  const r = rankTasks([T('1', 'Comprare latte'), T('2', 'Pulire casa')], [], NOW);
  assert.deepEqual(r.map((x) => x.task.id), ['1', '2']);
  assert.match(nextActionText(r), /Nessuno è urgente/);
});
test('urgente vince', () => {
  const r = rankTasks([T('1', 'A'), T('2', 'B'), T('3', 'C', { urgent: true })], [], NOW);
  assert.equal(r[0].task.id, '3');
  assert.match(r[0].reasons[0], /urgente/);
});
test('scadenze', () => {
  const r = rankTasks([T('1', 'A', { due: '2026-10-12' }), T('2', 'B', { due: '2026-10-07' }), T('3', 'C', { due: '2026-10-01' })], [], NOW);
  assert.deepEqual(r.map((x) => x.task.id), ['3', '2', '1']);
});
test('business plan prima dei investitori', () => {
  assert.ok(linked('Completare business plan', 'Chiamata investitori'));
  const r = rankTasks([T('1', 'Comprare latte'), T('2', 'Completare business plan')], [{ day: '2026-10-08', time: '17:30', title: 'Chiamata investitori' }], NOW);
  assert.equal(r[0].task.id, '2');
  assert.match(nextActionText(r), /prima di «Chiamata investitori» \(domani alle 17:30\)/);
});
test('task fatti ignorati', () => {
  assert.equal(rankTasks([T('1', 'A', { done: true })], [], NOW).length, 0);
});
