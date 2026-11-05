import test from 'node:test';
import assert from 'node:assert/strict';
import { workdays, balance, tenure, profileAlerts, candidateScore, rankCandidates, pipelineCounts, nextCStage, upcomingInterviews, declineText, offerText, trainingAlerts, goalsProgress, periodNow } from '../src/lib/hr.ts';
import { PROJECT_TEMPLATES } from '../src/lib/workTasks.ts';

test('giorni lavorativi senza weekend', () => {
  assert.equal(workdays('2026-11-02', '2026-11-06'), 5); assert.equal(workdays('2026-11-06', '2026-11-09'), 2); assert.equal(workdays('2026-11-07', '2026-11-08'), 0); assert.equal(workdays('2026-11-05', '2026-11-05'), 1);
});
test('ferie residue, malattia e permessi', () => {
  const A = (kind, from, to, status = 'approved') => ({ user_id: 'u', kind, from_day: from, to_day: to, status });
  const b = balance({ vacation_days: 25 }, [A('ferie', '2026-08-03', '2026-08-14'), A('ferie', '2026-12-28', '2027-01-08', 'requested'), A('malattia', '2026-03-02', '2026-03-03'), A('permesso', '2026-05-04', '2026-05-04'), A('ferie', '2025-12-29', '2026-01-02')], 2026);
  assert.deepEqual(b, { total: 25, taken: 12, pending: 4, left: 9, sick: 2, leave: 1 });
  assert.equal(balance(null, [], 2026).left, null);
});
test('anzianità e scadenze', () => {
  assert.equal(tenure('2024-08-10', '2026-11-05'), '2 anni e 2 mesi'); assert.equal(tenure('2026-10-20', '2026-11-05'), 'meno di un mese'); assert.equal(tenure('2026-06-01', '2026-11-05'), '5 mesi'); assert.equal(tenure(null, '2026-11-05'), '');
  const base = { hired_on: null, contract: 'indeterminato', contract_end: null, weekly_hours: 40, vacation_days: 20, phone: '', emergency: '' };
  assert.equal(profileAlerts({ ...base, contract: 'determinato', contract_end: '2026-12-15' }, '2026-11-05').length, 1);
  assert.equal(profileAlerts({ ...base, contract: 'indeterminato', contract_end: '2026-12-15' }, '2026-11-05').length, 0);
  assert.equal(profileAlerts({ ...base, hired_on: '2026-08-10' }, '2026-11-05')[0].kind, 'probation');
  assert.equal(profileAlerts({ ...base, hired_on: '2020-11-20' }, '2026-11-05')[0].kind, 'anniversary'); assert.deepEqual(profileAlerts(null, '2026-11-05'), []);
});
test('candidati: punteggio, classifica, fasi, colloqui', () => {
  assert.equal(candidateScore({ Competenze: 4, Esperienza: 3, Motivazione: 5 }), 4); assert.equal(candidateScore({}), null); assert.equal(candidateScore({ Competenze: 0 }), null);
  const C = (id, stage, scores, o = {}) => ({ id, name: id, role: 'Grafica', stage, scores, interview_at: null, ...o });
  const r = rankCandidates([C('a', 'new', { x: 3 }), C('b', 'interview', { x: 5 }), C('c', 'rejected', { x: 5 }), C('d', 'new', {}), C('e', 'hired', { x: 5 })]);
  assert.deepEqual(r.map((x) => x.id), ['b', 'a', 'd']);
  assert.deepEqual(pipelineCounts([C('a', 'new', {}), C('b', 'new', {}), C('c', 'offer', {})]).new, 2); assert.equal(nextCStage('offer'), 'hired'); assert.equal(nextCStage('hired'), null);
  const now = new Date('2026-11-05T09:00:00Z').getTime();
  assert.deepEqual(upcomingInterviews([C('a', 'interview', {}, { interview_at: '2026-11-04T10:00:00Z' }), C('b', 'interview', {}, { interview_at: '2026-11-07T10:00:00Z' }), C('c', 'interview', {}, { interview_at: '2026-11-06T10:00:00Z' })], now).map((x) => x.id), ['c', 'b']);
  assert.match(declineText('Laura', 'Grafica', 'Elena'), /Gentile Laura[\s\S]*posizione di Grafica[\s\S]*Elena/); assert.match(offerText('Laura', 'Grafica', '1/12/2026', 'Elena'), /con inizio il 1\/12\/2026/);
});
test('formazione, obiettivi, periodo', () => {
  const T = (id, exp) => ({ id, title: id, kind: 'certificato', done_on: null, expires_on: exp });
  assert.deepEqual(trainingAlerts([T('a', '2026-10-01'), T('b', '2026-12-01'), T('c', '2027-06-01'), T('d', null)], '2026-11-05').map((x) => [x.t.id, x.state]), [['a', 'scaduto'], ['b', 'in scadenza']]);
  assert.equal(goalsProgress([{ t: 'a', done: true }, { t: 'b', done: false }, { t: 'c', done: false }, { t: 'd', done: true }]), 50); assert.equal(goalsProgress([]), 0);
  assert.equal(periodNow('2026-11-05'), '2026-S2'); assert.equal(periodNow('2026-03-01'), '2026-S1');
  assert.ok(PROJECT_TEMPLATES.some((p) => p.id === 'uscita') && PROJECT_TEMPLATES.some((p) => p.id === 'onboarding'));
});
