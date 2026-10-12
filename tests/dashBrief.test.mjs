import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/lib/dashBrief.ts';

const NOW = 1_800_000_000_000;
const prefs = (o = {}) => ({ now: NOW, interest: {}, muted: [], snoozed: {}, feedback: {}, ...o });
const cand = (o = {}) => ({ id: 'a', topic: 'salute', severity: 'warn', urgency: 0.5, observed: 'x', period: 'ultimi 7 giorni', reliability: null, whyNow: 'y', followLabel: 'Apri', follow: { page: 'lifehealth' }, ...o });

test('affidabilità: pochi dati = bassa, correlazione mai alta, fatti non valutabili', () => {
  assert.equal(D.reliabilityOf({ kind: 'fact' }), null);
  assert.equal(D.reliabilityOf({ n: 3, kind: 'trend' }).level, 'bassa');
  assert.equal(D.reliabilityOf({ n: 20, significant: true, kind: 'trend' }).level, 'alta');
  assert.equal(D.reliabilityOf({ n: 10, kind: 'trend' }).level, 'media');
  assert.notEqual(D.reliabilityOf({ n: 90, kind: 'correlation' }).level, 'alta');
  assert.match(D.reliabilityOf({ n: 30, kind: 'correlation' }).why, /non una causa/);
});
test('massimo tre insight, ordinati per rilevanza; uno solo per argomento finché ce ne sono altri', () => {
  const cs = [cand({ id: '1', topic: 'salute', severity: 'bad' }), cand({ id: '2', topic: 'salute', severity: 'warn' }), cand({ id: '3', topic: 'finanza', severity: 'warn' }), cand({ id: '4', topic: 'agenda', severity: 'info' }), cand({ id: '5', topic: 'mente', severity: 'info' })];
  const out = D.rankCandidates(cs, prefs());
  assert.equal(out.length, 3);
  assert.deepEqual(new Set(out.map((c) => c.topic)).size, 3);
  assert.equal(out[0].id, '1');
});
test('gli interessi della persona cambiano l\'ordine', () => {
  const cs = [cand({ id: 'fin', topic: 'finanza', severity: 'warn' }), cand({ id: 'sal', topic: 'salute', severity: 'warn' })];
  assert.equal(D.rankCandidates(cs, prefs({ interest: { finanza: 20 } }))[0].id, 'fin');
  assert.equal(D.rankCandidates(cs, prefs({ interest: { salute: 20 } }))[0].id, 'sal');
});
test('«Non mi interessa»: l\'argomento viene tolto e ne compaiono meno dello stesso genere', () => {
  const cs = [cand({ id: 'sal1', topic: 'salute', sub: 'sleep', severity: 'bad' }), cand({ id: 'fin', topic: 'finanza', severity: 'warn' })];
  assert.equal(D.rankCandidates(cs, prefs({ muted: ['sub:salute:sleep'] })).some((c) => c.id === 'sal1'), false);
  assert.equal(D.rankCandidates(cs, prefs({ muted: ['sal1'] })).some((c) => c.id === 'sal1'), false);
  const penal = D.rankCandidates(cs, prefs({ feedback: { salute: { follow: 0, irrelevant: 3 } } }));
  assert.equal(penal[0].id, 'fin'); // la salute scartata più volte scende
  assert.ok(D.scoreCandidate(cs[0], prefs({ feedback: { salute: { follow: 0, irrelevant: 3 } } })) < D.scoreCandidate(cs[0], prefs()));
});
test('«Rimanda» nasconde fino a quando scade; le scadenze critiche non scendono per l\'argomento ridotto', () => {
  const c = cand({ id: 'x' });
  assert.equal(D.rankCandidates([c], prefs({ snoozed: { x: NOW + 1000 } })).length, 0);
  assert.equal(D.rankCandidates([c], prefs({ snoozed: { x: NOW - 1 } })).length, 1);
  const crit = cand({ id: 'bill', topic: 'finanza', severity: 'bad', urgency: 1, critical: true });
  const low = { feedback: { finanza: { follow: 0, irrelevant: 4 } } };
  assert.ok(D.scoreCandidate(crit, prefs(low)) >= D.scoreCandidate(crit, prefs()));
});
test('interessi da aree e temi', () => {
  const w = D.interestWeights({ areas: ['salute', 'soldi'], interests: ['Sport e movimento'], themes: { corsa: 8 } });
  assert.ok(w.salute > w.finanza);
  assert.deepEqual(D.interestWeights({ areas: [], interests: [], themes: {} }), {});
});
test('resoconto: pochi dati lo dice e non scrive stime; nulla di importante = stato tranquillo', () => {
  const base = { name: 'Alex', hour: 10, eventsToday: [{ time: '09:00', title: 'Dentista' }], openTasks: 2, urgentTasks: [], top: [] };
  const poor = D.buildBrief({ ...base, dataDays: 2, hasAnyData: true });
  assert.equal(poor.state, 'pochi_dati');
  assert.match(poor.dataNote, /2 giorni di dati/);
  assert.match(poor.dataNote, /niente stime/);
  const none = D.buildBrief({ ...base, dataDays: 0, hasAnyData: false });
  assert.match(none.dataNote, /non faccio stime/);
  const calm = D.buildBrief({ ...base, dataDays: 30, hasAnyData: true });
  assert.equal(calm.state, 'tranquillo');
  assert.equal(calm.lines.filter((l) => l.kind === 'reading').length, 0);
  assert.match(D.calmSuggestion({ nextEvent: { title: 'Riunione', time: '11:30', daysAhead: 0 }, eventsToday: 1 }), /Non emerge nulla/);
});
test('resoconto con dati: fatti, lettura e suggerimento distinti', () => {
  const top = [cand({ reading: 'Potrebbe dipendere da meno recupero.', suggestion: 'Anticipa di mezz\'ora l\'andare a letto.' })];
  const b = D.buildBrief({ name: 'A', hour: 9, eventsToday: [], openTasks: 0, urgentTasks: ['Relazione'], dataDays: 20, hasAnyData: true, top });
  assert.deepEqual(b.lines.map((l) => l.kind), ['fact', 'fact', 'reading', 'suggestion']);
});

test('un argomento intero si può togliere, ma non una scadenza critica', () => {
  const c = cand({ id: 'f', topic: 'finanza' });
  assert.equal(D.rankCandidates([c], prefs({ muted: ['topic:finanza'] })).length, 0);
  const crit = cand({ id: 'bill', topic: 'finanza', critical: true });
  assert.equal(D.rankCandidates([crit], prefs({ muted: ['topic:finanza'] })).length, 1);
  assert.equal(D.rankCandidates([crit], prefs({ muted: ['bill'] })).length, 0);
});
