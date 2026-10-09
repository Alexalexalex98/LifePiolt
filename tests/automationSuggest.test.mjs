import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestAutomations, expoWeekday } from '../src/lib/automationSuggest.ts';

const base = { openTasks: 0, urgentTasks: 0, avgSleep: null, overBudget: false, budgetSet: false, moodDaysLast7: 7, skippedSessions: 0, stalledGoals: 0, hasGoals: false, daysSinceWorkout: 1, eveningEvents: 0, existingKeys: [] };

test('4-8 proposte ordinate per utilità, con titolo, motivo e regola', () => {
  const r = suggestAutomations(base);
  assert.ok(r.length >= 4 && r.length <= 8);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  r.forEach((s) => { assert.ok(s.title && s.why && s.rule && s.key); });
});

test('poco sonno -> promemoria di andare a letto in cima', () => {
  const r = suggestAutomations({ ...base, avgSleep: 5.4 });
  assert.equal(r[0].key, 'bedtime');
  assert.match(r[0].why, /5,4/);
  assert.equal(r[0].notify.hour, 22); assert.equal(r[0].notify.minute, 30);
});

test('sessioni saltate >= 3 -> ripianifica da sola; è descrittiva (nessuna notifica)', () => {
  const r = suggestAutomations({ ...base, skippedSessions: 3 });
  assert.equal(r[0].key, 'replan-skipped');
  assert.equal(r[0].descriptive, true); assert.equal(r[0].notify, undefined);
  assert.equal(r[0].rule, 'Dopo 3 sessioni saltate: ripianifica da sola');
});

test('budget sforato -> controllo del venerdì; umore poco registrato -> check-in serale', () => {
  const r = suggestAutomations({ ...base, overBudget: true, budgetSet: true, moodDaysLast7: 1 }, 8).map((s) => s.key);
  assert.ok(r.indexOf('budget-friday') < 3);
  assert.ok(r.indexOf('mood-checkin') < 4);
  const b = suggestAutomations({ ...base, overBudget: true, budgetSet: true }).find((s) => s.key === 'budget-friday');
  assert.deepEqual([b.notify.kind, b.notify.weekday, b.notify.hour], ['weekly', 5, 18]);
});

test('le automazioni già presenti non vengono riproposte e il massimo è rispettato', () => {
  const r = suggestAutomations({ ...base, existingKeys: ['weekly-review', 'morning-briefing'] });
  assert.ok(!r.some((s) => ['weekly-review', 'morning-briefing'].includes(s.key)));
  assert.equal(suggestAutomations(base, 5).length, 5);
});

test('quelle con orario hanno notifica valida, le altre sono descrittive', () => {
  suggestAutomations({ ...base, hasGoals: true }, 10).forEach((s) => {
    if (s.notify) { assert.ok(s.notify.hour >= 0 && s.notify.hour < 24 && s.notify.minute >= 0 && s.notify.minute < 60); assert.equal(s.descriptive, false); }
    else assert.equal(s.descriptive, true);
  });
});

test('giorno Expo: domenica = 1, sabato = 7', () => {
  assert.equal(expoWeekday(0), 1); assert.equal(expoWeekday(5), 6); assert.equal(expoWeekday(6), 7);
});
