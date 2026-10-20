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
test('benessere: solo da dati veri (passi mancanti, sonno corto); niente consigli generici', () => {
  const p = buildPlan({ ...base, hour: 15, steps: 4000, stepsGoal: 8000, sleepHours: 5.5 });
  const texts = p.filter((x) => x.kind === 'benessere').map((x) => x.text).join(' | ');
  assert.match(texts, /Mancano 4\.000 passi/); assert.match(texts, /pausa breve/);
  assert.ok(!/acqua|allungati/i.test(texts));
  const q = buildPlan({ ...base, hour: 15 });
  assert.equal(q.filter((x) => x.kind === 'benessere').length, 0);
});
test('un task riconosciuto spiega cosa propone', () => {
  const p = buildPlan({ ...base, hour: 9, tasks: [{ id: 'a', t: 'Prenotare il dentista' }, { id: 'b', t: 'Fare la spesa' }] });
  assert.match(p.find((x) => x.taskId === 'a').why, /dentista/);
  assert.match(p.find((x) => x.taskId === 'b').why, /lista della spesa/);
});
test('impegni passati non compaiono; bollette in scadenza e messaggi sì', () => {
  const p = buildPlan({ ...base, hour: 15, events: [{ time: '09:00', title: 'Vecchio' }, { time: '16:00', title: 'Dentista' }], bills: [{ name: 'Luce', days: 1 }], unreadMessages: 2 });
  assert.ok(!p.some((x) => /Vecchio/.test(x.text)));
  assert.ok(p.some((x) => /Dentista/.test(x.text)) && p.some((x) => /Luce/.test(x.text)) && p.some((x) => x.kind === 'persone'));
  assert.match(planSummary(p), /1 impegno/);
});
test('Da fare adesso: c\'è sempre almeno un task se ce ne sono', () => {
  const p = buildPlan({ ...base, hour: 9, events: [{ time: '09:30', title: 'Riunione' }], bills: [{ name: 'Luce', days: 0 }, { name: 'Gas', days: 1 }], unreadMessages: 1, tasks: [{ id: 'a', t: 'Leggere' }] });
  assert.ok(topActions(p, 3).some((x) => x.kind === 'task'));
});
