import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, gradeTest, computeTrust, computeFit, shrunkRating, pickQuestions, hasAnswer, deadlineOf, timeLeftMs, isLate, fmtDuration, fmtLimit } from '../src/lib/hiring.ts';
import { bank, skillLabel, customSkill, isCustomSkill } from '../src/data/skillBank.ts';
import { parseTable, tableToText, niceMax } from '../src/lib/dataTable.ts';

const q = (id) => bank.find((x) => x.id === id);

test('domande a scelta e numeriche', () => {
  assert.equal(gradeAnswer(q('v3'), { qid: 'v3', value: 1, ms: 1000 }), 100);
  assert.equal(gradeAnswer(q('v3'), { qid: 'v3', value: 0, ms: 1000 }), 0);
  assert.equal(gradeAnswer(q('v4'), { qid: 'v4', value: '2700', ms: 1 }), 100);
  assert.equal(gradeAnswer(q('v4'), { qid: 'v4', value: '2.700,0', ms: 1 }), 0); // formato ambiguo: non si indovina
  assert.equal(gradeAnswer(q('a1'), { qid: 'a1', value: '15%', ms: 1 }), 100);
  assert.equal(gradeAnswer(q('a1'), { qid: 'a1', value: 16, ms: 1 }), 0);
  assert.equal(gradeAnswer(q('v5'), { qid: 'v5', value: 'testo', ms: 1 }), null); // aperta: serve una persona
  assert.equal(gradeAnswer(q('v5'), undefined, 70), 70);
});

test('le risposte della banca sono corrette', () => {
  // verifica indipendente delle risposte numeriche
  assert.equal(40 * 75 * 0.9, q('v4').answer);
  assert.equal(Math.round(((92 - 80) / 80) * 100), q('a1').answer);
  assert.equal(Math.round(((120 - 78) / 120) * 100), q('a3').answer);
  assert.equal(3 * 24 * 2.5, q('a5').answer);
  assert.equal(1 / (1 / 6 + 1 / 3), q('p3').answer);
  assert.equal((45 / 60) * 6, q('o4').answer);
  // ogni domanda a scelta ha esattamente una risposta da 100
  bank.filter((x) => x.kind === 'mc').forEach((x) => assert.equal(x.options.filter((o) => o.score === 100).length, 1, x.id));
  // ogni scenario ha almeno una risposta migliore a 100 e una peggiore bassa
  bank.filter((x) => x.kind === 'scenario').forEach((x) => { assert.ok(x.options.some((o) => o.score === 100), x.id); assert.ok(Math.min(...x.options.map((o) => o.score)) <= 25, x.id); });
});

test('punteggio test, tratti e coerenza', () => {
  const qs = ['t1', 't2', 't3', 't4', 't5', 't6'].map(q);
  const best = qs.map((x) => ({ qid: x.id, value: x.options.findIndex((o) => o.score === 100), ms: 8000 }));
  const r = gradeTest(qs, best);
  assert.equal(r.traits.affidabilita, 100); assert.equal(r.traits.onesta, 100); assert.equal(r.consistency, 100);
  // risposte incoerenti: ottime su un tratto e pessime su un altro nello stesso tratto
  const mixed = [{ qid: 't1', value: 1, ms: 8000 }, { qid: 't2', value: 0, ms: 8000 }, { qid: 't3', value: 1, ms: 8000 }];
  const r2 = gradeTest(['t1', 't2', 't3'].map(q), mixed);
  assert.ok(r2.consistency < 60, `coerenza ${r2.consistency}`);
  // risposte troppo veloci segnalate
  const fast = gradeTest(qs, qs.map((x) => ({ qid: x.id, value: 0, ms: 300 })));
  assert.ok(fast.flags.some((f) => /veloci/.test(f)));
});

test('domande aperte restano in attesa e non gonfiano il punteggio', () => {
  const qs = ['v3', 'v5'].map(q);
  const r = gradeTest(qs, [{ qid: 'v3', value: 1, ms: 5000 }, { qid: 'v5', value: 'Buongiorno…', ms: 90000 }]);
  assert.deepEqual(r.pending, ['v5']);
  assert.equal(r.skillScores.vendite, 100); // provvisorio: solo la parte corretta
  const r2 = gradeTest(qs, [{ qid: 'v3', value: 1, ms: 5000 }, { qid: 'v5', value: 'x', ms: 1 }], { v5: 50 });
  assert.equal(r2.skillScores.vendite, 75);
  assert.deepEqual(r2.pending, []);
});

test('affidabilità: pochi voti pesano meno, penalità per segnalazioni, mai un numero senza dati', () => {
  assert.ok(shrunkRating(5, 1) < shrunkRating(250, 50)); // 1 voto da 5 stelle vale meno di 50 voti da 5
  const empty = computeTrust({ ratingSum: 0, ratingCount: 0, receivedLP: 0, reports: 0, identityVerified: false, traitScores: {}, consistency: null, streak: 0 });
  assert.equal(empty.score, null); assert.equal(empty.confidence, 'nessuna');
  const strong = computeTrust({ ratingSum: 5 * 40, ratingCount: 40, receivedLP: 2000, reports: 0, identityVerified: true, traitScores: { affidabilita: 90, onesta: 90 }, consistency: 90, streak: 7 });
  const reported = computeTrust({ ratingSum: 5 * 40, ratingCount: 40, receivedLP: 2000, reports: 2, identityVerified: true, traitScores: { affidabilita: 90, onesta: 90 }, consistency: 90, streak: 7 });
  assert.equal(strong.confidence, 'alta');
  assert.ok(strong.score > 80);
  assert.equal(strong.score - reported.score, 30);
  const one = computeTrust({ ratingSum: 5, ratingCount: 1, receivedLP: 0, reports: 0, identityVerified: false, traitScores: {}, consistency: null, streak: 0 });
  assert.equal(one.confidence, 'bassa');
  assert.ok(one.score < strong.score);
});

test('adeguatezza al ruolo', () => {
  const reqs = [{ skill: 'vendite', weight: 3, min: 70 }, { skill: 'analisi', weight: 1, min: 50 }];
  const f = computeFit(reqs, { vendite: 90, analisi: 40 }, 80, 0.2);
  assert.equal(f.skillFit, 78); // (3*90+1*40)/4 = 77.5
  assert.equal(f.overall, 78);
  assert.deepEqual(f.unmet.map((u) => u.skill), ['analisi']);
  const g = computeFit(reqs, { vendite: 90 }, null);
  assert.deepEqual(g.missing, ['analisi']); assert.equal(g.overall, g.skillFit);
});

test('selezione domande ripetibile e senza duplicati', () => {
  const a = pickQuestions(bank, ['vendite', 'analisi'], 3, 7).map((x) => x.id);
  const b = pickQuestions(bank, ['vendite', 'analisi'], 3, 7).map((x) => x.id);
  assert.deepEqual(a, b); assert.equal(new Set(a).size, 6);
});

test('domanda con risposta file: in attesa di valutazione, poi voto della persona', () => {
  const f = { id: 'f1', skill: 'analisi', kind: 'file', prompt: 'Carica il foglio', w: 2 };
  const withFile = { qid: 'f1', value: '', ms: 5000, files: [{ uri: 'x', name: 'a.xlsx' }] };
  assert.ok(hasAnswer(withFile)); assert.ok(!hasAnswer({ qid: 'f1', value: '', ms: 1 }));
  assert.equal(gradeAnswer(f, withFile), null);
  assert.equal(gradeAnswer(f, withFile, 80), 80);
  const r = gradeTest([f, q('a1')], [withFile, { qid: 'a1', value: 15, ms: 4000 }]);
  assert.deepEqual(r.pending, ['f1']); assert.equal(r.answered, 2); assert.equal(r.skillScores.analisi, 100); // provvisorio
  const r2 = gradeTest([f, q('a1')], [withFile, { qid: 'a1', value: 15, ms: 4000 }], { f1: 40 });
  assert.equal(r2.skillScores.analisi, 60); // (40*2 + 100*1) / 3 = 60
  assert.deepEqual(r2.pending, []);
  // senza file: conta come domanda senza risposta (0), non in attesa
  const r3 = gradeTest([f], [{ qid: 'f1', value: '', ms: 1 }]);
  assert.deepEqual(r3.pending, []); assert.equal(r3.skillScores.analisi, 0);
});

test('domande matematiche: tolleranza relativa o assoluta, unità ignorata', () => {
  const rel = { id: 'm1', skill: 'problem', kind: 'number', prompt: '', answer: 200, tol: 0.05, unit: 'CHF' };
  assert.equal(gradeAnswer(rel, { qid: 'm1', value: '208 CHF', ms: 1 }), 100);
  assert.equal(gradeAnswer(rel, { qid: 'm1', value: '211', ms: 1 }), 0);
  const abs = { id: 'm2', skill: 'problem', kind: 'number', prompt: '', answer: 499.8, tolAbs: 0.5 };
  assert.equal(gradeAnswer(abs, { qid: 'm2', value: '499,5', ms: 1 }), 100);
  assert.equal(gradeAnswer(abs, { qid: 'm2', value: '500,5', ms: 1 }), 0);
  const exact = { id: 'm3', skill: 'problem', kind: 'number', prompt: '', answer: 62, tolAbs: 0 };
  assert.equal(gradeAnswer(exact, { qid: 'm3', value: 62, ms: 1 }), 100);
  assert.equal(gradeAnswer(exact, { qid: 'm3', value: 61, ms: 1 }), 0);
});

test('peso per domanda e competenze personalizzate', () => {
  const sk = customSkill('Excel avanzato');
  assert.equal(sk, 'custom:Excel avanzato'); assert.ok(isCustomSkill(sk)); assert.ok(!isCustomSkill('vendite'));
  assert.equal(skillLabel(sk), 'Excel avanzato'); assert.equal(skillLabel('custom:'), 'Personalizzata'); assert.equal(skillLabel('vendite'), 'Vendite e negoziazione');
  const a = { id: 'w1', skill: sk, kind: 'number', prompt: '', answer: 1, w: 3 };
  const b = { id: 'w2', skill: sk, kind: 'number', prompt: '', answer: 1 };
  const r = gradeTest([a, b], [{ qid: 'w1', value: 1, ms: 9000 }, { qid: 'w2', value: 5, ms: 9000 }]);
  assert.equal(r.skillScores[sk], 75); // (100*3 + 0*1) / 4
  const fit = computeFit([{ skill: sk, weight: 2, min: 70 }], r.skillScores, null);
  assert.equal(fit.skillFit, 75); assert.deepEqual(fit.unmet, []);
  // senza peso il comportamento resta quello di prima (media semplice)
  assert.equal(gradeTest([{ ...a, w: undefined }, b], [{ qid: 'w1', value: 1, ms: 9000 }, { qid: 'w2', value: 5, ms: 9000 }]).skillScores[sk], 50);
});

test('tabelle dati: CSV con punto e virgola, virgola, tabulazione e decimali', () => {
  const a = parseTable(';Gen;Feb\nNord;1,5;2\nSud;3;4,25');
  assert.ok(a.ok); assert.deepEqual(a.table.labels, ['Nord', 'Sud']);
  assert.deepEqual(a.table.series, [{ name: 'Gen', values: [1.5, 3] }, { name: 'Feb', values: [2, 4.25] }]);
  const b = parseTable('Mese,Incassi\nGen,10.5\nFeb,12');
  assert.ok(b.ok); assert.deepEqual(b.table.series[0].values, [10.5, 12]);
  const c = parseTable('x\tA\tB\nr1\t1\t2');
  assert.ok(c.ok); assert.equal(c.table.series.length, 2);
  const d = parseTable('Gen,5\nFeb,7'); // senza intestazione
  assert.ok(d.ok); assert.deepEqual(d.table.labels, ['Gen', 'Feb']); assert.equal(d.table.series[0].name, 'Serie 1');
  assert.ok(!parseTable('solo una riga').ok);
  const bad = parseTable('A,B\nx,abc\ny,2'); // intestazione + valore non numerico
  assert.ok(!bad.ok && /riga 2/.test(bad.error));
  const round = parseTable(tableToText(a.table)); assert.ok(round.ok); assert.deepEqual(round.table, a.table);
  assert.equal(niceMax(61), 100); assert.equal(niceMax(4.2), 5); assert.equal(niceMax(0), 1);
});

test('prova pratica: il tempo parte dal download, consegna in ritardo segnalata', () => {
  const t0 = 1_000_000_000_000;
  assert.equal(deadlineOf(t0, 90), t0 + 90 * 60000);
  assert.equal(timeLeftMs(t0, 90, t0 + 30 * 60000), 60 * 60000);
  assert.ok(timeLeftMs(t0, 90, t0 + 100 * 60000) < 0);
  assert.equal(isLate(t0, 90, t0 + 90 * 60000), false); // esattamente alla scadenza: in tempo
  assert.equal(isLate(t0, 90, t0 + 90 * 60000 + 1), true);
  assert.equal(fmtDuration(3725000), '1:02:05'); assert.equal(fmtDuration(65000), '1:05'); assert.equal(fmtDuration(-65000), '1:05');
  assert.equal(fmtLimit(45), '45 min'); assert.equal(fmtLimit(90), '1 h 30 min'); assert.equal(fmtLimit(120), '2 h');
});
