import test from 'node:test';
import assert from 'node:assert/strict';
import { POSITIONS, capsOf, canHandle, byArea, positionOf, positionsSql } from '../src/lib/workRoles.ts';

test('ogni posizione ha funzioni, responsabilità e id unico', () => {
  const ids = new Set(POSITIONS.map((p) => p.id)); assert.equal(ids.size, POSITIONS.length);
  for (const p of POSITIONS) { assert.ok(p.duties.length >= 1, p.id); assert.ok(p.responsible.length >= 1, p.id); assert.ok(p.summary.length > 10, p.id); }
  assert.ok(POSITIONS.length >= 28);
});
test('HR vede CV e buste paga, la contabile non vede le buste paga', () => {
  assert.equal(canHandle('hr', 'member', capsOf('member', 'hr_manager')), true);
  assert.equal(canHandle('person', 'member', capsOf('member', 'payroll')), true);
  assert.equal(canHandle('person', 'member', capsOf('member', 'accountant')), false);
  assert.equal(canHandle('fin', 'member', capsOf('member', 'accountant')), true);
  assert.equal(canHandle('hr', 'member', capsOf('member', 'employee')), false);
  assert.equal(canHandle('team', 'member', capsOf('member', undefined)), true);
});
test('gli amministratori hanno sempre tutto', () => {
  const c = capsOf('admin', undefined); assert.equal(c.size, 12); assert.equal(canHandle('admin', 'owner', capsOf('owner', null)), true);
  assert.equal(canHandle('admin', 'member', capsOf('member', 'hr_manager')), false);
});
test('solo HR e direzione gestiscono le persone; i responsabili approvano le ferie', () => {
  assert.equal(capsOf('member', 'hr_manager').has('members.manage'), true);
  assert.equal(capsOf('member', 'employee').has('members.manage'), false);
  assert.equal(capsOf('member', 'manager').has('absence.approve'), true);
  assert.equal(capsOf('member', 'intern').size, 0);
});
test('aree e SQL', () => {
  assert.ok(byArea().length >= 10); assert.equal(positionOf('hr_manager').area, 'hr');
  assert.match(positionsSql(), /\('hr_manager', array\['members.manage'/);
});
