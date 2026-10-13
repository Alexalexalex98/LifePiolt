import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, suggestCommands } from '../src/lib/assistantCommands.ts';

test('vuoto: i comandi più utili, pochi', () => {
  const s = suggestCommands('');
  assert.ok(s.length >= 3 && s.length <= 5);
});
test('filtra mentre si scrive', () => {
  assert.equal(suggestCommands('aggiu')[0].area === 'Piano' || suggestCommands('aggiu')[0].area === 'Task', true);
  assert.ok(suggestCommands('finanz').some((c) => c.id === 'fin'));
  assert.ok(suggestCommands('lifepoint').some((c) => c.id === 'lp' || c.id === 'help-lp'));
  assert.deepEqual(suggestCommands('xyzzy'), []);
});
test('id unici e testo da inserire', () => {
  assert.equal(new Set(COMMANDS.map((c) => c.id)).size, COMMANDS.length);
  assert.ok(COMMANDS.every((c) => c.insert.length > 3));
});
