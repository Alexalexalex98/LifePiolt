import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAiActions, validate, findByText } from '../src/lib/assistant/aiActionsCore.ts';

test('azioni proposte dall\'AI: si estraggono e si toglie la riga dal testo', () => {
  const r = parseAiActions('Imposto il piano.\n[[AZIONE {"type":"vacation_set","name":"Viaggio","goal":2000,"month":"2026-12"}]]\n[[AZIONE {"type":"task_add","t":"Chiamare Marco","due":"2026-11-03"}]]');
  assert.equal(r.text, 'Imposto il piano.');
  assert.deepEqual(r.actions.map((a) => a.type), ['vacation_set', 'task_add']);
});

test('azioni non valide o inventate vengono scartate', () => {
  assert.equal(validate({ type: 'vacation_set', name: 'x', goal: -5, month: '2026-12' }), null);
  assert.equal(validate({ type: 'event_add', title: 'a', date: '2026-13-40', time: '10:00' }), null);
  assert.equal(validate({ type: 'event_add', title: 'a', date: '2026-11-03', time: '25:00' }), null);
  assert.equal(validate({ type: 'open', page: 'evil' }), null);
  assert.equal(validate({ type: 'delete_everything' }), null);
  assert.equal(parseAiActions('ciao [[AZIONE {non json}]]').actions.length, 0);
});

test('al massimo 4 azioni per risposta', () => {
  const l = Array.from({ length: 6 }, (_, i) => `[[AZIONE {"type":"note_add","text":"n${i}"}]]`).join('\n');
  assert.equal(parseAiActions(l).actions.length, 4);
});

test('trovare una voce: unica, nessuna o ambigua', () => {
  const tasks = [{ t: 'Prenotare il dentista' }, { t: 'Comprare il latte' }, { t: 'Prenotare il treno' }];
  assert.equal(findByText(tasks, (x) => x.t, 'dentista').length, 1);
  assert.equal(findByText(tasks, (x) => x.t, 'prenotare').length, 2);
  assert.equal(findByText(tasks, (x) => x.t, 'pizza').length, 0);
});
