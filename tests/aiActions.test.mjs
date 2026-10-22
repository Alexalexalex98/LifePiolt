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

import { findChecks, dueFixed, chartCategory } from '../src/lib/statementChecks.ts';
const mk = (label, amount, ...dates) => dates.map((date) => ({ date, label, amount }));
test('controlli estratto: due casse malati nello stesso periodo => domanda, non si indovina', () => {
  const rows = [...mk('Concordia', -874, '2026-06-07', '2026-07-07', '2026-08-07'), ...mk('Css Kranken', -481, '2026-06-07', '2026-07-07', '2026-08-07')];
  const fixed = [{ name: 'Cassa malati e assicurazioni: Concordia', key: 'concordia', cls: 'Cassa malati e assicurazioni', monthly: 874 }, { name: 'Cassa malati e assicurazioni: Css Kranken', key: 'css kranken', cls: 'Cassa malati e assicurazioni', monthly: 481 }];
  const c = findChecks({ rows, fixed, incomes: [], answers: {} });
  assert.equal(c.length, 1); assert.equal(c[0].kind, 'multi');
  assert.equal(findChecks({ rows, fixed, incomes: [], answers: { [c[0].id]: 'all' } }).length, 0);
});
test('controlli estratto: due stipendi in periodi diversi => cambio lavoro', () => {
  const rows = [...mk('Ditta A', 4000, '2026-01-25', '2026-02-25', '2026-03-25'), ...mk('Ditta B', 4500, '2026-06-25', '2026-07-25', '2026-08-25')];
  const c = findChecks({ rows, fixed: [], incomes: [{ name: 'Ditta A', key: 'ditta a', monthly: 4000 }, { name: 'Ditta B', key: 'ditta b', monthly: 4500 }], answers: {} });
  assert.equal(c[0].kind, 'income-seq'); assert.deepEqual(c[0].options[0].effect.excludeIncome, ['ditta a']);
});
test('spese fisse non ancora addebitate questo mese', () => {
  const rows = mk('Affitto S Immo Sa', -1905, '2026-08-27', '2026-09-27');
  const d = dueFixed(rows, [{ name: 'Affitto: S Immo', key: 'affitto s immo sa', cls: 'Affitto', monthly: 1905 }], '2026-10-22');
  assert.equal(d.length, 1); assert.equal(d[0].day, 27);
});
test('grafico del mese usa la stessa classe dell\'estratto', () => {
  assert.equal(chartCategory('Bmw Schweiz Ag Abteilung Leasing', {}, () => 'Altro'), 'Prestiti e leasing');
  assert.equal(chartCategory('Concordia', {}, () => 'Altro'), 'Cassa malati');
});

import { oneOffTransfers, moveKey } from '../src/lib/financeCalc.ts';
test('giroconto una tantum resta fuori, uno che torna ogni mese conta come entrata', () => {
  const mv = (label, amount, date) => ({ label, amount, date });
  const months = ['Agosto 2026', 'Settembre 2026', 'Ottobre 2026'].map((label, i) => ({ label, start: 0, movements: [mv('Giro conto Mamma', 200, '05/0' + (8 + i)), ...(i === 2 ? [mv('Giro conto 2', 1000, '20/10')] : [])] }));
  const kinds = { [moveKey('Ottobre 2026', months[2].movements[0])]: 'transfer', [moveKey('Ottobre 2026', months[2].movements[1])]: 'transfer' };
  const off = oneOffTransfers(months, kinds, (l) => l.toLowerCase());
  assert.equal(off.has(moveKey('Ottobre 2026', months[2].movements[1])), true);
  assert.equal(off.has(moveKey('Ottobre 2026', months[2].movements[0])), false);
});
