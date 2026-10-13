import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, topActions, planSummary } from '../src/lib/dashPlan.ts';

const base = { hour: 14, events: [], tasks: [], todayKey: '2026-10-13' };
test('task urgente prima di tutto, poi scadenza, poi gli altri', () => {
  const p = buildPlan({ ...base, tasks: [{ id: 'a', t: 'Leggere', }, { id: 'b', t: 'Pagare', urgent: true }, { id: 'c', t: 'Chiamare', due: '2026-10-13' }] });
  const ids = p.filter((x) => x.kind === 'task').map((x) => x.taskId);
  assert.deepEqual(ids, ['b', 'c', 'a']);
});
test('completato un task, compare il successivo più importante', () => {
  const tasks = [{ id: 'b', t: 'Pagare', urgent: true }, { id: 'c', t: 'Chiamare', due: '2026-10-13' }, { id: 'a', t: 'Leggere' }];
  const before = topActions(buildPlan({ ...base, tasks }), 2).map((x) => x.id);
  const after = topActions(buildPlan({ ...base, tasks: tasks.map((x) => (x.id === 'b' ? { ...x, done: true } : x)) }), 2).map((x) => x.id);
  assert.ok(before.includes('task:b'));
  assert.ok(!after.includes('task:b'));
  assert.equal(after.length, 2);
});
test('benessere: acqua sempre, passi mancanti, sonno corto, e le voci fatte spariscono', () => {
  const p = buildPlan({ ...base, hour: 15, steps: 4000, stepsGoal: 8000, sleepHours: 5.5 });
  const texts = p.filter((x) => x.kind === 'benessere').map((x) => x.text).join(' | ');
  assert.match(texts, /acqua/); assert.match(texts, /Mancano 4\.000 passi/); assert.match(texts, /pausa breve/);
  const water = p.find((x) => /acqua/.test(x.text));
  const p2 = buildPlan({ ...base, hour: 15, done: [water.id.replace('well:', '')] });
  assert.ok(!p2.some((x) => /acqua/.test(x.text)));
});
test('impegni passati non compaiono; bollette in scadenza e messaggi sì', () => {
  const p = buildPlan({ ...base, hour: 15, events: [{ time: '09:00', title: 'Vecchio' }, { time: '16:00', title: 'Dentista' }], bills: [{ name: 'Luce', days: 1 }], unreadMessages: 2 });
  assert.ok(!p.some((x) => /Vecchio/.test(x.text)));
  assert.ok(p.some((x) => /Dentista/.test(x.text)) && p.some((x) => /Luce/.test(x.text)) && p.some((x) => x.kind === 'persone'));
  assert.match(planSummary(p), /1 impegno/);
});
test('di notte niente promemoria acqua', () => {
  assert.ok(!buildPlan({ ...base, hour: 2 }).some((x) => /acqua/.test(x.text)));
});
test('Da fare adesso: c\'è sempre almeno un task se ce ne sono', () => {
  const p = buildPlan({ ...base, hour: 9, events: [{ time: '09:30', title: 'Riunione' }], bills: [{ name: 'Luce', days: 0 }, { name: 'Gas', days: 1 }], unreadMessages: 1, tasks: [{ id: 'a', t: 'Leggere' }] });
  assert.ok(topActions(p, 3).some((x) => x.kind === 'task'));
});
