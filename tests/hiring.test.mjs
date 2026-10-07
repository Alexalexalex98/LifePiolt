import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, gradeTest, computeTrust, computeFit, shrunkRating, pickQuestions } from '../src/lib/hiring.ts';
import { bank } from '../src/data/skillBank.ts';

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
