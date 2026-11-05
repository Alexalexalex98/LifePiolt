import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, isYes, isNo, buildPrompt, offlineSteps } from '../src/lib/agent/plan.ts';

const K = new Set(['create_task', 'create_meeting']);
test('legge il piano, anche in un blocco di codice, e scarta azioni sconosciute', () => {
  const r = parsePlan('```json\n{"steps":[{"action":"create_task","params":{"title":"X"}},{"action":"rm_rf","params":{}},{"action":"create_meeting"}],"reply":"Fatto"}\n```', K);
  assert.deepEqual(r.steps.map((s) => s.action), ['create_task', 'create_meeting']); assert.deepEqual(r.steps[1].params, {}); assert.equal(r.reply, 'Fatto');
});
test('domande, rinvii e risposte rotte', () => {
  assert.equal(parsePlan('{"steps":[],"ask":"A che ora?"}', K).ask, 'A che ora?'); assert.equal(parsePlan('{"steps":[],"fallback":"files"}', K).fallback, 'files'); assert.equal(parsePlan('{"steps":[],"fallback":"boh"}', K).fallback, undefined);
  assert.equal(parsePlan('niente json', K), null); assert.equal(parsePlan('{rotto', K), null);
  const many = JSON.stringify({ steps: Array.from({ length: 20 }, () => ({ action: 'create_task', params: {} })) }); assert.equal(parsePlan(many, K).steps.length, 8);
});
test('sì e no', () => { assert.equal(isYes('Sì, vai'), true); assert.equal(isYes('ok'), true); assert.equal(isYes('no grazie'), false); assert.equal(isNo('No, lascia'), true); assert.equal(isNo('sì'), false); });
test('il prompt ha data, persone e azioni ma non i dati', () => {
  const p = buildPrompt({ today: '2026-11-05', myName: 'Alex', people: [{ name: 'Giulia Verdi', position: 'Responsabile HR' }], projects: ['Sito nuovo'], templates: ['Nuovo sito web'], actions: '- create_task(title*): Crea un task', request: 'Crea un task per Giulia' });
  assert.match(p, /giovedì 2026-11-05/); assert.match(p, /Giulia Verdi \(Responsabile HR\)/); assert.match(p, /create_task\(title\*\)/); assert.match(p, /Richiesta: Crea un task per Giulia/);
});

test('richieste semplici senza AI', () => {
  assert.equal(offlineSteps('Cosa ho oggi?')[0].action, 'today_summary'); assert.equal(offlineSteps('Pianifica i miei task')[0].action, 'plan_my_tasks');
  assert.equal(offlineSteps('Avvisa chi è in ritardo')[0].action, 'alert_late'); assert.equal(offlineSteps('Crea un preventivo per Bianchi'), null);
});
