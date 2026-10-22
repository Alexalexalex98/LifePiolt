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

import { cutCandidates } from '../src/lib/theia/core.ts';
test('dove tagliare: niente voci essenziali, in ordine di risparmio', () => {
  const r = cutCandidates([
    { name: 'Cassa X', cls: 'Cassa malati e assicurazioni', monthly: 993, kind: 'fissa' },
    { name: 'Netflix', cls: 'Abbonamenti', monthly: 100, kind: 'fissa' },
    { name: 'Bar', cls: 'Ristoranti e bar', monthly: 200, kind: 'variabile' },
    { name: 'Varie', cls: 'Altro', monthly: 1000, kind: 'variabile' },
  ]);
  assert.deepEqual(r.map((x) => x.item.name), ['Varie', 'Bar', 'Netflix']);
  assert.deepEqual(r.map((x) => x.save), [200, 60, 40]);
});

import { isLearnable, recall, makeEntry, addEntry } from '../src/lib/theiaMemory.ts';
test('memoria: impara solo conoscenza generale, non cose personali o legate all\'ora', () => {
  const r = 'La fotosintesi è il processo con cui le piante trasformano luce, acqua e anidride carbonica in zuccheri e ossigeno.';
  assert.equal(isLearnable('Come funziona la fotosintesi clorofilliana nelle piante', r), true);
  assert.equal(isLearnable('Quanto ho speso questo mese in ristoranti', r), false);
  assert.equal(isLearnable('Che tempo fa domani a Lugano', r), false);
  assert.equal(isLearnable('E quello invece come funziona', r), false);
  assert.equal(isLearnable('Come funziona la fotosintesi clorofilliana nelle piante', 'Non lo so, riprova più tardi con un altra domanda.'), false);
});
test('memoria: ritrova una domanda simile e non una diversa', () => {
  const e = makeEntry('Come funziona la fotosintesi clorofilliana nelle piante', 'Risposta lunga abbastanza per essere ricordata dal telefono di Theia.');
  const kb = addEntry([], e);
  assert.equal(recall(kb, 'Come funziona la fotosintesi nelle piante')?.id, e.id);
  assert.equal(recall(kb, 'Come funziona il motore a scoppio delle automobili'), null);
});
