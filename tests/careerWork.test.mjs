import test from 'node:test';
import assert from 'node:assert/strict';
import { quarterOf, quarterRange, objProgress, okrStatus, quarterElapsed, gapsOf, strengthsOf, suggestSkills, suggestFromTasks, adKeywords, buildCv, coverLetter, salaryRange, answeredRatio, QUESTIONS, reviewSummary, krProgress } from '../src/lib/careerWork.ts';

test('trimestri', () => {
  assert.equal(quarterOf('2026-11-05'), '2026-T4'); assert.equal(quarterOf('2026-03-31'), '2026-T1');
  assert.deepEqual(quarterRange('2026-T4'), ['2026-10-01', '2026-12-31']);
  assert.equal(quarterElapsed('2026-T4', '2026-10-01'), 0); assert.equal(quarterElapsed('2026-T4', '2027-02-01'), 100);
});
test('OKR: avanzamento e stato', () => {
  const o = { id: 'o', title: 'x', quarter: '2026-T4', krs: [{ id: 'a', t: 'a', target: 10, current: 5 }, { id: 'b', t: 'b', target: 4, current: 4 }] };
  assert.equal(objProgress(o), 75); assert.equal(krProgress({ id: 'c', t: '', target: 0, current: 5 }), 0);
  assert.equal(okrStatus(o, '2026-11-15').state, 'avanti');
  assert.equal(okrStatus({ ...o, krs: [{ id: 'a', t: 'a', target: 10, current: 0 }] }, '2026-12-15').state, 'indietro');
  assert.equal(okrStatus({ ...o, krs: [{ id: 'a', t: 'a', target: 1, current: 1 }] }, '2026-11-15').state, 'finito');
  assert.equal(objProgress({ ...o, krs: [] }), 0);
});
test('competenze: lacune e punti di forza', () => {
  const l = [{ id: '1', name: 'Excel', level: 2, target: 4 }, { id: '2', name: 'Trattativa', level: 4, target: 4 }, { id: '3', name: 'SEO', level: 1, target: 2 }];
  assert.deepEqual(gapsOf(l).map((s) => s.name), ['Excel', 'SEO']); assert.deepEqual(strengthsOf(l).map((s) => s.name), ['Trattativa']);
  assert.ok(!suggestSkills('commerciale', l).includes('Trattativa') && suggestSkills('commerciale', l).includes('CRM'));
});
test('risultati dai task finiti', () => {
  const s = suggestFromTasks([{ t: 'Offerta Bianchi', doneAt: '2026-11-01', team: 't' }, { t: 'Privato', doneAt: '2026-11-01' }, { t: 'Vecchio', doneAt: '2026-01-01', team: 't' }], [], '2026-11-05');
  assert.deepEqual(s.map((x) => x.t), ['Offerta Bianchi']);
  assert.equal(suggestFromTasks([{ t: 'Offerta Bianchi', doneAt: '2026-11-01', team: 't' }], [{ id: 'r', day: '2026-11-01', text: 'Ho completato: Offerta Bianchi' }], '2026-11-05').length, 0);
});
test('annuncio, CV e lettera', () => {
  const skills = [{ id: '1', name: 'Excel', level: 4, target: 4 }, { id: '2', name: 'Trattativa', level: 3, target: 4 }, { id: '3', name: 'SEO', level: 1, target: 3 }];
  const ad = 'Cerchiamo un commerciale con Excel e Trattativa. Esperienza di fatturazione e fatturazione elettronica.';
  const k = adKeywords(ad, skills); assert.deepEqual(k.matched.map((s) => s.name), ['Excel', 'Trattativa']); assert.ok(k.missing.includes('fatturazione'));
  const cv = buildCv({ name: 'Anna Rossi', headline: 'Commerciale', skills, results: [{ id: 'r', day: '2026-10-01', text: 'Chiuso il contratto Bianchi', metric: '+20% fatturato' }], courses: [{ id: 'c', title: 'Corso vendita', status: 'finito' }, { id: 'd', title: 'Altro', status: 'da fare' }] }, ad);
  assert.match(cv, /ANNA ROSSI/); assert.match(cv, /Excel \(Esperto\)/); assert.doesNotMatch(cv, /SEO/); assert.match(cv, /\+20% fatturato/); assert.match(cv, /Corso vendita/); assert.doesNotMatch(cv, /Altro/);
  assert.match(coverLetter({ name: 'Anna', company: 'Rossi Srl', role: 'Commerciale', matched: k.matched, results: [] }), /Rossi Srl[\s\S]*excel, trattativa/);
});
test('stipendio e colloquio', () => {
  const r = salaryRange({ target: 4000, offer: 3500 });
  assert.deepEqual(r.ask, [4000, 4400]); assert.ok(r.walkAway >= 3700); assert.ok(r.lines.some((l) => /sotto il tuo obiettivo/.test(l)));
  assert.equal(answeredRatio(QUESTIONS, {}), 0);
  assert.equal(answeredRatio(QUESTIONS.slice(0, 2), { presenta: 'Una risposta abbastanza lunga da contare', perche: 'corta' }), 50);
});
test('riepilogo per aumento o colloquio', () => {
  const t = reviewSummary([{ id: 'a', day: '2026-10-02', text: 'Chiuso Bianchi', metric: '+10k' }, { id: 'b', day: '2025-01-01', text: 'Vecchio' }], [{ id: 'f', day: '2026-10-05', from: 'Giulia', text: 'Ottimo lavoro', kind: 'positivo' }, { id: 'g', day: '2026-10-06', from: 'Marco', text: 'Sii più chiaro', kind: 'crescita' }], '2026-07-01', '2026-12-31');
  assert.match(t, /Chiuso Bianchi \(\+10k\)/); assert.match(t, /Giulia/); assert.doesNotMatch(t, /Vecchio|Marco/);
});
