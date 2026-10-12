import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, defaultChoices, allPrivate, setChoice } from '../src/lib/dataCatalog.ts';
import { bindGate, canShare, evaluate, guardedPayload, logOutflow } from '../src/lib/privacyGate.ts';
import { AUDIENCE_LABEL, LOG_MAX, makeEntry, pushCapped, filterEntries, removeMatching, normalizeEntries, summarize, audienceKind } from '../src/lib/privacyLog.ts';

const AUDIENCES = ['router_ai', 'chat:abc', 'network_public', 'club', 'employer', 'sync', 'export'];
const open = () => { let c = defaultChoices(); for (const it of CATALOG) { const o = it.options.find((x) => x.shared); if (o && !(it.sensitivity === 'critico')) { const r = setChoice(c, it.id, o.id); if (r.ok) c = r.choices; } } return c; };

test('ogni dato critico e\' negato per ogni destinatario, anche con azione esplicita e scelte aperte', () => {
  const crit = CATALOG.filter((i) => i.sensitivity === 'critico');
  assert.ok(crit.length >= 7);
  for (const choices of [defaultChoices(), open(), allPrivate(defaultChoices())]) {
    for (const it of crit) for (const a of AUDIENCES) {
      const g = evaluate(choices, it.id, a, { explicit: true, mode: 'dettagli' });
      assert.equal(g.allowed, false, `${it.id} -> ${a}`);
      assert.equal(g.level, 'none');
      const gp = guardedPayload(it.id, a, { secret: '1234' }, { choices, explicit: true, log: false });
      assert.equal(gp.allowed, false);
      assert.equal(gp.payload, undefined);
    }
  }
});

test('destinatario o dato sconosciuti: negato; senza collegamento il gate nega tutto', () => {
  assert.equal(evaluate(defaultChoices(), 'plan_agenda', 'boh').allowed, false);
  assert.equal(evaluate(defaultChoices(), 'inesistente', 'export').allowed, false);
  bindGate({ choices: () => allPrivate(defaultChoices()) });
  assert.equal(canShare('ai_memory', 'router_ai').allowed, false);
  assert.equal(canShare('health_activity', 'router_ai').allowed, false);
});

test('assistente AI: solo le voci scelte per l\'assistente', () => {
  const c = defaultChoices();
  assert.equal(evaluate(c, 'ai_memory', 'router_ai').allowed, true, 'memoria e\' attiva di default');
  assert.equal(evaluate(c, 'health_activity', 'router_ai').allowed, false);
  assert.equal(evaluate(c, 'fin_summary', 'router_ai').allowed, false);
  const on = setChoice(setChoice(c, 'health_activity', 'on').choices, 'fin_summary', 'on').choices;
  assert.equal(evaluate(on, 'health_activity', 'router_ai').allowed, true);
  assert.equal(evaluate(on, 'fin_summary', 'router_ai').allowed, true);
  // altre voci condivise con persone non vanno all'AI, nemmeno con azione esplicita
  assert.equal(evaluate(open(), 'plan_tasks', 'router_ai', { explicit: true }).allowed, false);
  assert.equal(evaluate(open(), 'plan_agenda', 'router_ai').allowed, false);
  assert.equal(evaluate(open(), 'contacts', 'router_ai', { explicit: true }).allowed, false);
});

test('agenda: livelli liberi < occupato < dettagli, anche con azione esplicita', () => {
  const lvl = (opt) => setChoice(defaultChoices(), 'plan_agenda', opt).choices;
  const off = lvl('off');
  assert.equal(evaluate(off, 'plan_agenda', 'chat:1').allowed, false);
  assert.equal(evaluate(off, 'plan_agenda', 'chat:1', { explicit: true, mode: 'liberi' }).allowed, false);
  const free = lvl('free');
  assert.equal(evaluate(free, 'plan_agenda', 'chat:1', { mode: 'liberi' }).level, 'liberi');
  assert.equal(evaluate(free, 'plan_agenda', 'chat:1', { mode: 'occupato' }).allowed, false);
  assert.equal(evaluate(free, 'plan_agenda', 'chat:1', { mode: 'dettagli', explicit: true }).allowed, false);
  const busy = lvl('busy');
  assert.equal(evaluate(busy, 'plan_agenda', 'chat:1', { mode: 'occupato' }).allowed, true);
  assert.equal(evaluate(busy, 'plan_agenda', 'chat:1', { mode: 'dettagli' }).allowed, false);
  const full = lvl('full');
  assert.equal(evaluate(full, 'plan_agenda', 'chat:1', { mode: 'dettagli' }).allowed, true);
  assert.equal(evaluate(full, 'plan_agenda', 'network_public').allowed, false);
  assert.equal(evaluate(full, 'plan_agenda', 'sync').allowed, false);
  // senza modo esplicito il livello e' il massimo consentito
  assert.equal(evaluate(busy, 'plan_agenda', 'club').level, 'occupato');
});

test('agenda: mascheramento del payload secondo il livello', () => {
  const agenda = { title: 'x', range: '7 giorni', mode: 'dettagli', items: [{ day: '2026-10-12', time: '10:00', title: 'Visita dal dentista' }], busy: [{ day: '2026-10-12', from: '10:00', to: '11:00' }], free: [{ day: '2026-10-12', from: '11:00', to: '12:00' }] };
  const lvl = (opt) => setChoice(defaultChoices(), 'plan_agenda', opt).choices;
  const g1 = guardedPayload('plan_agenda', 'chat:1', { ...agenda }, { choices: lvl('free'), log: false });
  assert.equal(g1.allowed, true);
  assert.deepEqual(g1.payload.items, []);
  assert.equal(g1.payload.busy, undefined);
  assert.equal(g1.payload.free.length, 1);
  assert.deepEqual(g1.removed.sort(), ['busy', 'items']);
  const g2 = guardedPayload('plan_agenda', 'chat:1', { ...agenda }, { choices: lvl('busy'), log: false });
  assert.deepEqual(g2.payload.items, []);
  assert.equal(g2.payload.busy.length, 1);
  assert.equal(g2.payload.mode, 'occupato');
  const g3 = guardedPayload('plan_agenda', 'chat:1', { ...agenda }, { choices: lvl('full'), log: false });
  assert.equal(g3.payload.items.length, 1);
  assert.deepEqual(g3.removed, []);
  // il payload originale non viene modificato
  assert.equal(agenda.items.length, 1);
  assert.ok(!JSON.stringify(g1.payload).includes('dentista'));
});

test('contatti: solo quelli scelti, mai senza azione esplicita', () => {
  const list = [{ id: 'a', name: 'Anna', phone: '1' }, { id: 'b', name: 'Bruno', phone: '2' }, { id: 'c', name: 'Carla', phone: '3' }];
  const c = defaultChoices();
  assert.equal(guardedPayload('contacts', 'chat:1', list, { choices: c, log: false }).allowed, false);
  const g = guardedPayload('contacts', 'chat:1', list, { choices: c, explicit: true, chosen: ['b'], log: false });
  assert.deepEqual(g.payload.map((x) => x.id), ['b']);
  assert.deepEqual(guardedPayload('contacts', 'chat:1', list, { choices: c, explicit: true, log: false }).payload, []);
  assert.equal(guardedPayload('contacts', 'sync', list, { choices: c, explicit: true, log: false }).allowed, false);
});

test('chat/club/employer: voce condivisa oppure azione esplicita; rete pubblica solo "tutti"; sync solo account', () => {
  const c = defaultChoices();
  assert.equal(evaluate(c, 'plan_tasks', 'chat:1').allowed, false);
  assert.equal(evaluate(c, 'plan_tasks', 'chat:1', { explicit: true }).allowed, true);
  assert.equal(evaluate(c, 'net_jobs', 'employer').allowed, false);
  assert.equal(evaluate(c, 'net_jobs', 'employer', { explicit: true }).allowed, true);
  assert.equal(evaluate(c, 'pub_name', 'network_public').allowed, true);
  assert.equal(evaluate(c, 'card_phone', 'network_public').allowed, false);
  assert.equal(evaluate(c, 'acc_name', 'sync').allowed, true);
  assert.equal(evaluate(c, 'plan_tasks', 'sync').allowed, false);
  assert.equal(evaluate(c, 'net_enroll', 'sync').allowed, true, 'e2e condiviso per natura');
  assert.equal(evaluate(c, 'plan_notes', 'export').allowed, true);
  assert.equal(evaluate(c, 'plan_agenda', 'export').level, 'dettagli');
});

test('biglietto: telefono ed email dipendono dalla scelta', () => {
  let c = defaultChoices();
  assert.equal(evaluate(c, 'card_phone', 'chat:1').allowed, false);
  c = setChoice(c, 'card_phone', 'on').choices;
  assert.equal(evaluate(c, 'card_phone', 'chat:1').allowed, true);
  assert.equal(evaluate(c, 'acc_email', 'chat:1').allowed, false);
});

test('verso AI, sync e rete pubblica i testi sono redatti (email, IBAN, telefoni)', () => {
  const c = setChoice(defaultChoices(), 'health_activity', 'on').choices;
  const g = guardedPayload('health_activity', 'router_ai', { note: 'scrivimi a mario.rossi@example.com o al +41 79 123 45 67' }, { choices: c, log: false });
  assert.equal(g.allowed, true);
  assert.ok(!/mario\.rossi/.test(g.payload.note));
  assert.ok(!/123 45 67/.test(g.payload.note));
  assert.ok(g.removed.includes('testi sensibili'));
});

test('registro di uscita: solo metadati, tetto 2000, filtri, eliminazione', () => {
  const rec = [];
  bindGate({ choices: () => defaultChoices(), record: (e) => rec.push(e) });
  guardedPayload('plan_agenda', 'chat:UTENTE-SEGRETO-42', { items: [{ title: 'Segreto' }], busy: [], mode: 'dettagli' }, { mode: 'liberi' });
  guardedPayload('fin_accounts', 'router_ai', { saldo: 12345 });
  logOutflow('ai_memory', 'router_ai', { count: 3 });
  assert.equal(rec.length, 3);
  assert.equal(rec[1].outcome, 'denied');
  assert.equal(rec[1].count, 0);
  assert.equal(rec[2].count, 3);
  // il contenuto non compare mai nel record
  assert.ok(!JSON.stringify(rec).includes('Segreto'));
  assert.ok(!JSON.stringify(rec).includes('12345'));
  const e = makeEntry(rec[0]);
  assert.equal(e.audience, 'chat');
  assert.ok(!JSON.stringify(e).includes('UTENTE-SEGRETO'));
  assert.deepEqual(Object.keys(e).sort(), ['audience', 'count', 'dataId', 'id', 'outcome', 'ts']);
  assert.equal(makeEntry({ audience: 'boh', dataId: 'x', outcome: 'ok' }), null);
  let list = [];
  for (let i = 0; i < LOG_MAX + 50; i++) list = pushCapped(list, makeEntry({ audience: i % 2 ? 'router_ai' : 'club', dataId: 'd' + i, outcome: i % 5 ? 'ok' : 'denied', ts: 1000 + i }));
  assert.equal(list.length, LOG_MAX);
  assert.equal(list[0].dataId, 'd' + (LOG_MAX + 49));
  const ai = filterEntries(list, { audience: 'router_ai' });
  assert.ok(ai.length > 0 && ai.every((x) => x.audience === 'router_ai'));
  const rest = removeMatching(list, { audience: 'router_ai' });
  assert.equal(rest.length + ai.length, list.length);
  assert.equal(removeMatching(list, {}).length, 0);
  assert.equal(summarize(list).total, LOG_MAX);
  assert.equal(normalizeEntries([{ junk: 1 }, null, ...list.slice(0, 3)]).length, 3);
  assert.equal(audienceKind('chat:12'), 'chat');
  assert.ok(AUDIENCE_LABEL.router_ai);
});

test('canShare non registra nulla; guardedPayload con log:false nemmeno', () => {
  const rec = [];
  bindGate({ choices: () => defaultChoices(), record: (e) => rec.push(e) });
  canShare('ai_memory', 'router_ai');
  guardedPayload('ai_memory', 'router_ai', {}, { log: false });
  assert.equal(rec.length, 0);
  guardedPayload('ai_memory', 'router_ai', { t: 1 });
  assert.equal(rec.length, 1);
});
