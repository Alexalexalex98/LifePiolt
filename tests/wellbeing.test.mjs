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
