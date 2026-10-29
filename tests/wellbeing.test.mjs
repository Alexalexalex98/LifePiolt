import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreQuestionnaire, isDue } from '../src/lib/wellbeing/questionnaires.ts';
import { deviations } from '../src/lib/wellbeing/baseline.ts';

test('WHO-5: somma per 4 e fasce', () => {
  assert.equal(scoreQuestionnaire('who5', [5, 5, 5, 5, 5]).score, 100);
  assert.equal(scoreQuestionnaire('who5', [1, 1, 1, 1, 1]).band, 'alto');
  assert.equal(scoreQuestionnaire('who5', [2, 2, 2, 2, 2]).band, 'attenzione');
  assert.equal(scoreQuestionnaire('who5', [3, 3, 3, 3, 3]).band, 'ok');
});

test('PHQ-9: fasce e domanda 9 (pensieri di morte)', () => {
  assert.equal(scoreQuestionnaire('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 0]).label, 'minimo');
  assert.equal(scoreQuestionnaire('phq9', [1, 1, 1, 1, 1, 1, 1, 1, 0]).label, 'lieve');
  assert.equal(scoreQuestionnaire('phq9', [3, 3, 3, 3, 3, 3, 3, 3, 0]).band, 'alto');
  assert.equal(scoreQuestionnaire('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1]).selfHarm, true);
  assert.equal(scoreQuestionnaire('phq9', [3, 3, 3, 3, 3, 3, 3, 3, 0]).selfHarm, false);
});

test('questionario: si ripropone dopo due settimane', () => {
  const now = Date.parse('2026-10-29T10:00:00Z');
  assert.equal(isDue('who5', undefined, now), true);
  assert.equal(isDue('who5', now - 5 * 86400000, now), false);
  assert.equal(isDue('who5', now - 15 * 86400000, now), true);
});

const series = (vals, today = '2026-10-29') => vals.map((v, i) => ({ d: new Date(Date.parse(today + 'T00:00:00Z') - (vals.length - 1 - i) * 86400000).toISOString().slice(0, 10), v }));
const steady = (n, v) => Array.from({ length: n }, (_, i) => v + (i % 3 === 0 ? 0.3 : -0.2));

test('baseline: servono due settimane di dati', () => {
  const r = deviations([{ id: 'sleep', label: 'Sonno', bad: 'down', pts: series(steady(8, 7.5)) }], '2026-10-29');
  assert.equal(r.ready, false); assert.equal(r.level, 'nessuno');
});

test('baseline: un solo segnale e\' lieve, piu\' segnali insieme sono attenzione o forte', () => {
  const sleep = series([...steady(30, 7.5), 5.5, 5.4, 5.6, 5.5, 5.3]);
  const mood = series([...steady(30, 3.8), 2.4, 2.5, 2.2, 2.6, 2.3]);
  const meals = series([...steady(30, 80), 40, 45, 35, 40, 38]);
  assert.equal(deviations([{ id: 'sleep', label: 'Sonno', bad: 'down', pts: sleep }], '2026-10-29').level, 'lieve');
  assert.equal(deviations([{ id: 'sleep', label: 'Sonno', bad: 'down', pts: sleep }, { id: 'mood', label: 'Umore', bad: 'down', pts: mood }], '2026-10-29').level, 'attenzione');
  assert.equal(deviations([{ id: 'sleep', label: 'Sonno', bad: 'down', pts: sleep }, { id: 'mood', label: 'Umore', bad: 'down', pts: mood }, { id: 'mealRhythm', label: 'Ritmo dei pasti', bad: 'down', pts: meals }], '2026-10-29').level, 'forte');
});

test('baseline: nessuna deviazione se tutto e\' nel solito', () => {
  const sleep = series(steady(35, 7.5));
  assert.equal(deviations([{ id: 'sleep', label: 'Sonno', bad: 'down', pts: sleep }], '2026-10-29').level, 'nessuno');
});

import { detectCrisis } from '../src/lib/safety.ts';
test('sicurezza: frasi indirette sono riconosciute, i modi di dire no', () => {
  for (const f of ['non ha più senso vivere', 'vorrei sparire', 'voglio morire', 'penso al suicidio', 'I want to die']) assert.equal(detectCrisis(f), true, f);
  for (const f of ['muoio dal ridere', 'sono morto di sonno oggi', 'ho voglia di una pizza']) assert.equal(detectCrisis(f), false, f);
});

import { computeLifeScore } from '../src/lib/wellbeing/score.ts';
import { analyze } from '../src/lib/analytics.ts';
const D = (id, better, target, dec = 1, unit = '') => ({ id, label: id, unit, domain: 'salute', better, target, dec, color: '#fff', period: 'day' });
const defs = { mood: D('mood', 'up', 3.5, 1, '/5'), sleep: D('sleep', 'range', undefined, 1, 'h'), social: D('social', 'up', 3, 1), steps: D('steps', 'up', 8000, 0), energyLvl: D('energyLvl', 'up', 3.5, 1, '/5') };
defs.sleep.range = [7, 9];

const mk = (id, vals, today = '2026-10-29') => {
  const pts = vals.map((v, i) => ({ d: new Date(Date.parse(today + 'T00:00:00Z') - (vals.length - 1 - i) * 86400000).toISOString().slice(0, 10), v }));
  return analyze({ def: defs[id], pts, source: 'manuale' }, today);
};
test('Life Score v2: senza dati non inventa un numero', () => {
  const r = computeLifeScore({ list: [mk('mood', [4, 4, 4, 4, 4, 4, 4])], today: '2026-10-29', days: 7 });
  assert.equal(r.score, null); assert.match(r.summary, /Mi mancano/);
});
test('Life Score v2: tutto bene e stabile = alto, con i motivi', () => {
  const list = [mk('mood', steady(30, 4)), mk('sleep', steady(30, 7.8)), mk('social', steady(30, 3.5)), mk('steps', steady(30, 9000)), mk('energyLvl', steady(30, 4))];
  const r = computeLifeScore({ list, today: '2026-10-29', days: 30 });
  assert.ok(r.score >= 85, String(r.score)); assert.equal(r.deviation.level, 'nessuno'); assert.ok(r.factors.length >= 5);
});
test('Life Score v2: piu\' segnali che peggiorano insieme abbassano e limitano il punteggio, con il perche\'', () => {
  const list = [mk('mood', [...steady(30, 4), 2.4, 2.5, 2.2, 2.6, 2.3]), mk('sleep', [...steady(30, 7.5), 5.4, 5.5, 5.3, 5.6, 5.4]), mk('social', [...steady(30, 3.5), 0.5, 0.4, 0.6, 0.5, 0.3]), mk('energyLvl', [...steady(30, 4), 2, 2, 1.5, 2, 2])];
  const r = computeLifeScore({ list, today: '2026-10-29', days: 35 });
  assert.ok(r.score < 65, String(r.score)); assert.equal(r.deviation.level, 'forte');
  assert.ok(r.reasons.some((x) => /insieme/.test(x))); assert.ok(r.down.length >= 2); assert.match(r.limits, /non diagnostica/);
});
test('Life Score v2: WHO-5 molto basso limita il punteggio', () => {
  const list = [mk('mood', steady(30, 4)), mk('sleep', steady(30, 7.8)), mk('social', steady(30, 3.5)), mk('steps', steady(30, 9000))];
  const r = computeLifeScore({ list, today: '2026-10-29', days: 30, who5: { score: 20, ts: Date.parse('2026-10-25T10:00:00Z') }, now: Date.parse('2026-10-29T10:00:00Z') });
  assert.ok(r.score <= 65, String(r.score)); assert.ok(r.who5);
});
