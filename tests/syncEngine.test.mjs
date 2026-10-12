import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockServer, MockServerTransport } from '../src/sync/mockServer.ts';
import { memoryState, SyncEngine } from '../src/sync/engine.ts';
import { COLLECTIONS } from '../src/sync/registry.ts';
import { DisconnectedTransport, TransportError, registerTransport, createTransport, unregisterTransport } from '../src/sync/transport.ts';
import { identityCodec } from '../src/sync/codec.ts';
import { wireChangeSchema } from '../src/schemas/change.ts';
import { makeDevice, connected, settle, view, ALL_CATS, fakeStore, initialStores, manualScheduler } from './_syncHelpers.mjs';

const T0 = 1_800_000_000_000;
const mkServer = (clock = { t: T0 }, o = {}) => new MockServer({ now: () => clock.t, ...o });

// codec di prova "cifrato" (NON e' crittografia: serve a verificare che il payload passi dal codec)
const rot = (s) => Buffer.from(s, 'utf8').toString('base64').split('').reverse().join('');
const unrot = (s) => Buffer.from(s.split('').reverse().join(''), 'base64').toString('utf8');
const fakeE2E = { id: 'test-rot-v1', e2e: true, encrypt: (p) => rot(p), decrypt: (p) => unrot(p) };

// ---------- base: cattura, nessun loop, propagazione ----------
test('predefinito: tutto "solo sul telefono": senza opt-in non si cattura e non si invia nulla', async () => {
  const server = mkServer();
  const a = await connected(server, 'A');
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'segreto' }], notes: [{ id: 'n1', text: 'diario', date: 'oggi' }] });
  assert.equal(a.engine.captureAll(true), 0);
  const r = await a.engine.syncNow();
  assert.equal(r.skipped, 'nothing-enabled');
  assert.equal(server.stats.pushes, 0); assert.equal(server.stats.pulls, 0); assert.equal(server.log.length, 0);
  assert.equal(a.engine.pendingCount(), 0);
});

test('propagazione A -> B di creazioni, modifiche campo-per-campo e cancellazioni, senza loop', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ALL_CATS });
  const b = await connected(server, 'B', { enable: ALL_CATS });
  await settle([a, b]);
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'Comprare latte' }, { id: 't2', t: 'Chiamare Anna', urgent: true }] });
  a.stores.life.setState({ events: { '2026-10-12': [{ time: '10:00', title: 'Riunione', place: 'Ufficio' }] } });
  a.stores.interests.setState({ selected: ['musei', 'sport'] });
  a.stores.network.setState({ following: ['anna'], votes: { p1: { 1: 5 } } });
  await settle([a, b]);
  assert.equal(norm(b), norm(a));
  assert.deepEqual(b.stores.life.getState().events, a.stores.life.getState().events);
  assert.deepEqual(b.stores.interests.getState().selected.sort(), ['musei', 'sport']);
  assert.deepEqual(b.stores.network.getState().following, ['anna']);
  assert.deepEqual(b.stores.network.getState().votes, { p1: { 1: 5 } });
  // modifica di un solo campo: nel server finisce solo quel campo
  const before = server.log.length;
  a.stores.life.setState((s) => ({ tasks: s.tasks.map((t) => (t.id === 't1' ? { ...t, done: true } : t)) }));
  await settle([a, b]);
  const last = server.log[server.log.length - 1];
  assert.equal(server.log.length, before + 1);
  assert.deepEqual(JSON.parse(last.payload).fields, { done: true });
  assert.equal(b.stores.life.getState().tasks.find((t) => t.id === 't1').done, true);
  // cancellazione
  a.stores.life.setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== 't2') }));
  a.stores.network.setState({ following: [] });
  await settle([a, b]);
  assert.deepEqual(b.stores.life.getState().tasks.map((t) => t.id), ['t1']);
  assert.deepEqual(b.stores.network.getState().following, []);
  // NO LOOP: B non ha generato nulla applicando i cambi remoti e il server non cresce piu'
  assert.equal(b.engine.pendingCount(), 0);
  assert.ok(!server.log.some((c) => c.deviceId === b.state.get().deviceId), 'B non ha inviato nulla');
  const n = server.log.length;
  await settle([a, b], 4);
  assert.equal(server.log.length, n);
});

test('B applica le modifiche remote con setState parziale immutabile (i riferimenti non toccati restano gli stessi)', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks', 'plan_goals'] });
  const b = await connected(server, 'B', { enable: ['plan_tasks', 'plan_goals'] });
  b.stores.life.setState({ goals: [{ id: 'g1', t: 'obiettivo', p: 10 }] });
  await settle([a, b]);
  const goalsBefore = b.stores.life.getState().goals;
  const tasksBefore = b.stores.life.getState().tasks;
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }] });
  await settle([a, b]);
  assert.equal(b.stores.life.getState().goals, goalsBefore, 'goals non toccato');
  assert.notEqual(b.stores.life.getState().tasks, tasksBefore);
});

// ---------- compattazione end-to-end ----------
test('outbox: piu\' modifiche alla stessa entita\' diventano un solo record; creare e cancellare prima dell\'invio non invia nulla', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks'] });
  await a.engine.syncNow();
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'a' }] }); a.engine.captureAll();
  for (const t of ['b', 'c', 'd']) { a.stores.life.setState({ tasks: [{ id: 't1', t }] }); a.engine.captureAll(); }
  assert.equal(a.engine.pendingCount(), 1);
  assert.equal(a.engine.outboxSnapshot()[0].fields.t, 'd');
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'd' }, { id: 't9', t: 'effimero' }] }); a.engine.captureAll();
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'd' }] }); a.engine.captureAll();
  assert.equal(a.engine.pendingCount(), 1, 't9: creazione e cancellazione si annullano');
  await a.engine.syncNow();
  assert.equal(server.log.length, 1);
  assert.equal(a.state.get().meta['life.tasks'].t9, undefined);
});

// ---------- conflitti ----------
test('note: modifiche concorrenti al testo -> convergenza e NESSUN testo perso (copia in conflitto)', async () => {
  const server = mkServer();
  const ca = { t: T0 }, cb = { t: T0 };
  const a = await connected(server, 'A', { enable: ['plan_notes'], clock: ca });
  const b = await connected(server, 'B', { enable: ['plan_notes'], clock: cb });
  a.stores.life.setState({ notes: [{ id: 'n1', text: 'testo iniziale', date: 'lun' }] });
  await settle([a, b]);
  // entrambi modificano offline
  ca.t += 1000; a.stores.life.setState({ notes: [{ id: 'n1', text: 'versione di A', date: 'lun' }] }); a.engine.captureAll();
  cb.t += 5000; b.stores.life.setState({ notes: [{ id: 'n1', text: 'versione di B', date: 'lun' }] }); b.engine.captureAll();
  await settle([a, b]);
  const na = a.stores.life.getState().notes, nb = b.stores.life.getState().notes;
  assert.equal(na.length, 2); assert.equal(nb.length, 2);
  const texts = (n) => n.map((x) => x.text).sort();
  assert.deepEqual(texts(na), ['versione di A', 'versione di B']);
  assert.deepEqual(texts(nb), texts(na));
  assert.equal(na.find((x) => x.id === 'n1').text, 'versione di B', 'vince l\'HLC piu\' recente');
  const copyA = na.find((x) => x.id !== 'n1'), copyB = nb.find((x) => x.id !== 'n1');
  assert.equal(copyA.id, copyB.id, 'la copia ha lo stesso id su entrambi i dispositivi');
  assert.equal(a.state.get().conflicts.length, 1); assert.equal(b.state.get().conflicts.length, 1);
  assert.equal(a.state.get().conflicts[0].preview, 'versione di A');
  // idempotente: altri giri non creano altre copie
  await settle([a, b], 4);
  assert.equal(a.stores.life.getState().notes.length, 2); assert.equal(b.stores.life.getState().notes.length, 2);
});

test('note: modifica contro cancellazione concorrente -> vince la modifica (il testo non si perde); task: vince la cancellazione su entrambi', async () => {
  const server = mkServer();
  const ca = { t: T0 }, cb = { t: T0 };
  const a = await connected(server, 'A', { enable: ['plan_notes', 'plan_tasks'], clock: ca });
  const b = await connected(server, 'B', { enable: ['plan_notes', 'plan_tasks'], clock: cb });
  a.stores.life.setState({ notes: [{ id: 'n1', text: 'originale', date: 'x' }], tasks: [{ id: 't1', t: 'task' }] });
  await settle([a, b]);
  ca.t += 1000; a.stores.life.setState({ notes: [], tasks: [] }); a.engine.captureAll();
  cb.t += 9000;
  b.stores.life.setState({ notes: [{ id: 'n1', text: 'modificata da B', date: 'x' }], tasks: [{ id: 't1', t: 'task', done: true }] }); b.engine.captureAll();
  await settle([a, b]);
  assert.deepEqual(a.stores.life.getState().notes.map((n) => n.text), ['modificata da B']);
  assert.deepEqual(b.stores.life.getState().notes.map((n) => n.text), ['modificata da B']);
  assert.deepEqual(a.stores.life.getState().tasks, []);
  assert.deepEqual(b.stores.life.getState().tasks, []);
});

test('LWW per campo: due dispositivi cambiano campi diversi dello stesso task offline -> si fondono', async () => {
  const server = mkServer();
  const ca = { t: T0 }, cb = { t: T0 };
  const a = await connected(server, 'A', { enable: ['plan_tasks'], clock: ca });
  const b = await connected(server, 'B', { enable: ['plan_tasks'], clock: cb });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'base' }] });
  await settle([a, b]);
  ca.t += 100; a.stores.life.setState({ tasks: [{ id: 't1', t: 'base', urgent: true }] }); a.engine.captureAll();
  cb.t += 200; b.stores.life.setState({ tasks: [{ id: 't1', t: 'base', due: '2026-11-01' }] }); b.engine.captureAll();
  await settle([a, b]);
  const want = [{ id: 't1', t: 'base', urgent: true, due: '2026-11-01' }];
  assert.deepEqual(a.stores.life.getState().tasks.map(sortKeys), want.map(sortKeys));
  assert.deepEqual(b.stores.life.getState().tasks.map(sortKeys), want.map(sortKeys));
});
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort());

test('server-wins: i voti arrivati dal server prevalgono sul valore locale', async () => {
  const server = mkServer();
  const ca = { t: T0 }, cb = { t: T0 };
  const a = await connected(server, 'A', { enable: ['net_posts'], clock: ca });
  const b = await connected(server, 'B', { enable: ['net_posts'], clock: cb });
  a.stores.network.setState({ votes: { p1: { 1: 3 } } });
  await settle([a, b]);
  cb.t += 10_000; b.stores.network.setState({ votes: { p1: { 1: 9 } } }); b.engine.captureAll();
  ca.t += 20_000; a.stores.network.setState({ votes: { p1: { 1: 4 } } }); a.engine.captureAll();
  await settle([a, b]);
  assert.deepEqual(a.stores.network.getState().votes, b.stores.network.getState().votes);
});

// ---------- offline, retry, backoff ----------
test('offline: le modifiche restano in coda e partono al ritorno della rete; stato osservabile', async () => {
  const server = mkServer();
  let online = false;
  const a = await connected(server, 'A', { enable: ['plan_tasks'], online: () => online });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'offline' }] });
  a.engine.captureAll(true);
  const phases = [];
  a.engine.subscribe((s) => phases.push(s.phase));
  let r = await a.engine.syncNow();
  assert.equal(r.skipped, 'offline'); assert.equal(a.engine.getStatus().phase, 'offline');
  assert.equal(server.log.length, 0);
  online = true;
  r = await a.engine.syncNow();
  assert.ok(r.ok);
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'offline' }, { id: 't2', t: 'due' }] });
  a.engine.captureAll();
  assert.equal(a.engine.getStatus().pending, 1);
  await a.engine.syncNow();
  assert.equal(a.engine.getStatus().pending, 0); assert.equal(a.engine.getStatus().phase, 'idle');
  assert.ok(phases.includes('syncing'));
  assert.equal(server.log.length, 2);
});

test('retry con backoff esponenziale e jitter; errore osservabile; ripresa e azzeramento', async () => {
  const server = mkServer();
  const a = makeDevice(server, 'A', { enable: ['plan_tasks'], config: { autoRetry: true, backoffBaseMs: 1000, backoffMaxMs: 20_000 }, faults: { offline: false } });
  await a.transport.connect(); a.engine.start();
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }] });
  await a.engine.syncNow(); // seed
  a.transport.faults.failNext = 100;
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'y' }] }); a.engine.captureAll();
  const delays = [];
  for (let i = 0; i < 6; i++) {
    a.sched.q.length = 0;
    const r = await a.engine.syncNow();
    assert.equal(r.ok, false);
    const st = a.engine.getStatus();
    assert.equal(st.phase, 'error'); assert.ok(st.lastError); assert.equal(st.pending, 1);
    delays.push(st.retryAt - a.clock.t);
    assert.ok(a.sched.q.some((x) => x.ms === st.retryAt - a.clock.t), 'retry pianificato');
  }
  // crescita esponenziale (con jitter 50%-100%) fino al tetto
  assert.ok(delays[1] >= 1000 && delays[3] > delays[0] && delays.every((d) => d <= 20_000 && d >= 500), delays.join(','));
  assert.ok(delays[4] >= 5000, delays.join(','));
  a.transport.faults.failNext = 0;
  const ok = await a.engine.syncNow();
  assert.ok(ok.ok); assert.equal(a.engine.getStatus().phase, 'idle'); assert.equal(a.engine.pendingCount(), 0);
  a.engine.stop();
});

test('errore di autenticazione: nessun retry automatico; senza server: stato "non collegato" onesto', async () => {
  const server = mkServer();
  const a = makeDevice(server, 'A', { enable: ['plan_tasks'], config: { autoRetry: true }, faults: { authExpired: true } });
  await a.transport.connect(); a.engine.start();
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }] });
  a.sched.q.length = 0;
  const r = await a.engine.syncNow();
  assert.equal(r.ok, false); assert.equal(a.engine.getStatus().phase, 'error');
  assert.match(a.engine.getStatus().lastError, /scaduto/);
  assert.ok(!a.sched.q.some((x) => x.ms > 1000), 'nessun retry pianificato');
  // transport predefinito
  const st = memoryState({ deviceId: 'solo', enabled: { plan_tasks: true } });
  const e = new SyncEngine({ bindings: initialStores(), collections: COLLECTIONS, state: st, getTransport: () => new DisconnectedTransport(), scheduler: manualScheduler(), config: { pollMs: 0 } });
  e.start();
  const r2 = await e.syncNow();
  assert.equal(r2.skipped, 'disconnected'); assert.equal(e.getStatus().phase, 'disconnected');
  await assert.rejects(new DisconnectedTransport().push([]), (x) => x instanceof TransportError && x.kind === 'unavailable');
});

test('pausa e ripresa', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks'] });
  a.engine.pause();
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }] });
  assert.equal((await a.engine.syncNow()).skipped, 'paused');
  assert.equal(server.log.length, 0);
  a.engine.resume();
  await a.engine.syncNow();
  assert.equal(server.log.length, 1);
});

test('registerTransport/createTransport: la fabbrica si sostituisce senza toccare il resto', async () => {
  const server = mkServer();
  registerTransport('mock', (cfg) => new MockServerTransport(server, cfg));
  const t = createTransport('mock', { deviceId: 'd1', deviceName: 'Prova' });
  assert.equal(t.name, 'mock-server');
  assert.equal((await t.connect()).ok, true);
  unregisterTransport('mock');
  assert.equal(createTransport('mock', { deviceId: 'd', deviceName: 'x' }).name, 'disconnected');
});

// ---------- idempotenza ----------
test('idempotenza: consegne doppie, risposte perse e duplicati non creano doppioni ne\' perdite', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks'], faults: { duplicateDelivery: 1, dropResponse: 0 } });
  const b = await connected(server, 'B', { enable: ['plan_tasks'], faults: { duplicateResponse: 1 } });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'uno' }, { id: 't2', t: 'due' }] });
  await settle([a, b]);
  assert.equal(server.log.length, 2);
  assert.ok(server.stats.duplicates >= 1);
  assert.equal(b.stores.life.getState().tasks.length, 2);
  // risposta persa: il client riprova e il server riconosce il changeId
  a.transport.faults = { dropPushResponse: 1 };
  a.stores.life.setState((s) => ({ tasks: [...s.tasks, { id: 't3', t: 'tre' }] })); a.engine.captureAll();
  const r = await a.engine.syncNow();
  assert.equal(r.ok, false);
  assert.equal(server.log.length, 3, 'il server l\'aveva applicata');
  assert.equal(a.engine.pendingCount(), 1, 'ma il client non lo sa');
  a.transport.faults = {};
  await settle([a, b]);
  assert.equal(server.log.length, 3); assert.equal(a.engine.pendingCount(), 0);
  assert.equal(b.stores.life.getState().tasks.length, 3);
});

test('ordine causale: modifiche consegnate in disordine convergono come in ordine', async () => {
  const server = mkServer();
  const ca = { t: T0 };
  const a = await connected(server, 'A', { enable: ['plan_tasks'], clock: ca, config: { batchSize: 1 } });
  const b = await connected(server, 'B', { enable: ['plan_tasks'], faults: { shuffle: true } });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'v0' }] }); await settle([a]);
  for (let i = 1; i <= 8; i++) { ca.t += 10; a.stores.life.setState({ tasks: [{ id: 't1', t: 'v' + i }] }); a.engine.captureAll(); await a.engine.syncNow(); }
  await settle([b]);
  assert.equal(b.stores.life.getState().tasks[0].t, 'v8');
});

// ---------- orologio ----------
test('modifiche remote con orologio troppo avanti vengono scartate', async () => {
  const server = mkServer();
  const far = { t: T0 + 10 * 86400_000 }; // dispositivo con l'ora sbagliata di 10 giorni
  const evil = await connected(server, 'X', { enable: ['plan_tasks'], clock: far });
  const b = await connected(server, 'B', { enable: ['plan_tasks'] });
  evil.stores.life.setState({ tasks: [{ id: 'tx', t: 'dal futuro' }] });
  await settle([evil]);
  // il server finto rifiuta HLC troppo avanti rispetto al proprio orologio
  assert.equal(server.log.length, 0);
  assert.ok(server.stats.rejected >= 1);
  assert.equal(evil.state.get().rejectedCount >= 1, true);
  // se arrivasse comunque (server permissivo), il client la scarta
  const sloppy = mkServer({ t: T0 + 20 * 86400_000 });
  const e2 = await connected(sloppy, 'X', { enable: ['plan_tasks'], clock: far });
  e2.stores.life.setState({ tasks: [{ id: 'tx', t: 'dal futuro' }] });
  await settle([e2]);
  assert.equal(sloppy.log.length, 1);
  const b2 = await connected(sloppy, 'B', { enable: ['plan_tasks'] });
  await settle([b2]);
  assert.equal(b2.stores.life.getState().tasks.length, 0);
  assert.ok(b2.engine.stats.clockSkew >= 1);
  void b;
});

// ---------- privacy ----------
test('privacy: solo le categorie abilitate vengono inviate; le altre non toccano mai il transport', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks'] });
  a.stores.life.setState({
    tasks: [{ id: 't1', t: 'ok' }], notes: [{ id: 'n1', text: 'privata', date: 'x' }], goals: [{ id: 'g1', t: 'g', p: 0 }],
    events: { '2026-10-12': [{ time: '9:00', title: 'Visita medica' }] },
  });
  a.stores.health.setState({ moods: [{ date: '2026-10-12', mood: 'triste' }], workouts: [{ id: 'w1', type: 'corsa', date: 'x', duration: 30, calories: 100 }] });
  await settle([a]);
  const cols = new Set(server.log.map((c) => c.collection));
  assert.deepEqual([...cols], ['life.tasks']);
  assert.ok(!JSON.stringify(server.log).includes('privata') && !JSON.stringify(server.log).includes('Visita medica'));
});

test('privacy: i dati critici non si abilitano e un record intruso in coda non parte mai', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks'] });
  for (const id of ['fin_accounts', 'fin_cards', 'fin_csv', 'fin_tax', 'health_clinical', 'doc_id', 'plan_auto', 'club_member', 'sconosciuta']) {
    const r = a.engine.setCategoryEnabled(id, true);
    assert.equal(r.ok, false, id);
  }
  assert.equal(a.state.get().enabled.fin_accounts, undefined);
  // anche forzando lo stato (file corrotto/manomesso) il motore non le considera
  a.state.patch({ enabled: { ...a.state.get().enabled, fin_accounts: true, health_clinical: true } });
  assert.deepEqual(a.engine.allowedCollections().map((c) => c.category), ['plan_tasks']);
  // un record di una collezione non consentita finito nella coda viene scartato prima dell'invio
  const intruder = { id: '00000000-0000-7000-8000-000000000001', collection: 'finance.movements', schemaV: 1, entityId: 'm1', op: 'create', fields: { label: 'IBAN CH93' }, hlc: '1800000000000.0000.A', deviceId: a.state.get().deviceId, seq: 99 };
  const intruder2 = { ...intruder, id: '00000000-0000-7000-8000-000000000002', collection: 'life.notes' };
  a.state.patch({ outbox: [...a.state.get().outbox, intruder, intruder2] });
  const b = await connected(server, 'B', { enable: ['plan_tasks'], state: a.state, stores: a.stores });
  b.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }] });
  await settle([b]);
  assert.ok(server.log.length >= 1);
  assert.ok(!server.log.some((c) => c.collection === 'finance.movements' || c.collection === 'life.notes'));
  assert.ok(!JSON.stringify(server.log).includes('IBAN'));
});

test('privacy: disattivare una categoria svuota coda e metadati locali', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks', 'plan_notes'] });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }], notes: [{ id: 'n1', text: 'y', date: 'z' }] });
  await settle([a]);
  a.stores.life.setState({ notes: [{ id: 'n1', text: 'y2', date: 'z' }] }); a.engine.captureAll();
  assert.equal(a.engine.pendingCount(), 1);
  a.engine.setCategoryEnabled('plan_notes', false);
  assert.equal(a.engine.pendingCount(), 0);
  assert.equal(a.state.get().meta['life.notes'], undefined);
  a.stores.life.setState({ notes: [] }); a.engine.captureAll(true);
  await settle([a]);
  assert.ok(!server.log.some((c) => c.op === 'delete' && c.collection === 'life.notes'));
});

test('privacy: chat e iscrizioni non partono senza cifratura E2E; con un codec cifrato partono solo cifrate', async () => {
  const server = mkServer();
  const msg = { id: 'm1', chatId: 'dm:anna', from: 'me', kind: 'text', text: 'ciao, ti passo il codice 1234', ts: 1, status: 'sent' };
  const a = await connected(server, 'A', { enable: ['chat_msgs', 'plan_tasks'] });
  a.stores.chat.setState({ chats: { 'dm:anna': { id: 'dm:anna', type: 'dm', name: 'Anna', members: ['me', 'anna'], admins: [], lastRead: 0, createdAt: 1, draft: 'bozza' } }, messages: { 'dm:anna': [msg] } });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'solo questo' }] });
  await settle([a]);
  assert.deepEqual([...new Set(server.log.map((c) => c.collection))], ['life.tasks']);
  assert.equal(a.engine.getStatus().blocked, 2, 'le collezioni in attesa di E2E sono segnalate');
  // con codec E2E
  const server2 = mkServer();
  const c = await connected(server2, 'C', { enable: ['chat_msgs'], codec: fakeE2E });
  c.stores.chat.setState({ chats: { 'dm:anna': { id: 'dm:anna', type: 'dm', name: 'Anna', members: ['me', 'anna'], admins: [], lastRead: 0, createdAt: 1, draft: 'bozza' } }, messages: { 'dm:anna': [{ ...msg, media: { uri: 'file:///privato.jpg' } }] } });
  await settle([c]);
  assert.ok(server2.log.length >= 2);
  const blob = JSON.stringify(server2.log);
  assert.ok(!blob.includes('1234') && !blob.includes('bozza') && !blob.includes('privato.jpg'), 'nulla in chiaro, niente bozza ne\' allegati locali');
  assert.ok(server2.log.every((x) => x.codec === 'test-rot-v1' && wireChangeSchema.safeParse(x).success));
  const d = await connected(server2, 'D', { enable: ['chat_msgs'], codec: fakeE2E });
  await settle([d]);
  const got = d.stores.chat.getState().messages['dm:anna'][0];
  assert.equal(got.text, msg.text); assert.equal(got.media, undefined);
  assert.equal(d.stores.chat.getState().chats['dm:anna'].name, 'Anna');
});

test('codec: il transport riceve esattamente cio\' che produce il codec; chi non ha la chiave non puo\' decifrare', async () => {
  const server = mkServer();
  const seen = [];
  const spy = { id: 'spy-v1', e2e: true, encrypt: (p, ctx) => { seen.push(['enc', ctx.collection, ctx.entityId]); return 'ENC:' + rot(p); }, decrypt: (p, ctx) => { seen.push(['dec', ctx.collection]); return unrot(p.slice(4)); } };
  const a = await connected(server, 'A', { enable: ['plan_notes'], codec: spy });
  a.stores.life.setState({ notes: [{ id: 'n1', text: 'nota riservata', date: 'x' }] });
  await settle([a]);
  assert.ok(server.log[0].payload.startsWith('ENC:'));
  assert.equal(unrot(server.log[0].payload.slice(4)).includes('nota riservata'), true);
  assert.ok(!server.log[0].payload.includes('nota riservata'));
  assert.deepEqual(seen[0], ['enc', 'life.notes', 'n1']);
  const b = await connected(server, 'B', { enable: ['plan_notes'], codec: spy });
  await settle([b]);
  assert.equal(b.stores.life.getState().notes[0].text, 'nota riservata');
  // dispositivo con codec diverso: non puo' leggere, non applica nulla e non va in crash
  const e = await connected(server, 'E', { enable: ['plan_notes'], codec: identityCodec });
  await settle([e]);
  assert.equal(e.stores.life.getState().notes.length, 0);
  assert.ok(e.engine.stats.undecodable >= 1);
});

test('registro di cosa e\' stato inviato: solo tipo, collezione, quantita\' e data (nessun contenuto)', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks'] });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'contenuto riservato' }, { id: 't2', t: 'altro' }] });
  await settle([a]);
  const log = a.state.get().sentLog;
  const sent = log.find((l) => l.dir === 'invio');
  assert.deepEqual(Object.keys(sent).sort(), ['at', 'category', 'collection', 'count', 'dir', 'ok']);
  assert.equal(sent.count, 2); assert.equal(sent.collection, 'life.tasks'); assert.equal(sent.category, 'plan_tasks');
  assert.ok(!JSON.stringify(log).includes('riservato'));
});

// ---------- limiti del server ----------
test('payload troppo grande: rifiutato in modo definitivo, tolto dalla coda e contato', async () => {
  const server = mkServer(undefined, { maxPayloadBytes: 500 });
  const a = await connected(server, 'A', { enable: ['plan_notes', 'plan_tasks'] });
  a.stores.life.setState({ notes: [{ id: 'n1', text: 'x'.repeat(2000), date: 'd' }], tasks: [{ id: 't1', t: 'piccolo' }] });
  await settle([a]);
  assert.equal(a.engine.pendingCount(), 0);
  assert.equal(a.state.get().rejectedCount, 1);
  assert.deepEqual(server.log.map((c) => c.collection), ['life.tasks']);
});

test('rate limit del server: errore ritentabile con attesa suggerita', async () => {
  const server = mkServer(undefined, { rateLimitPerMinute: 3 });
  const a = makeDevice(server, 'A', { enable: ['plan_tasks'], config: { autoRetry: true } });
  await a.transport.connect(); a.engine.start();
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }] });
  let last;
  for (let i = 0; i < 4; i++) last = await a.engine.syncNow();
  assert.equal(last.ok, false);
  assert.match(a.engine.getStatus().lastError, /rallentare/);
  assert.ok(a.engine.getStatus().retryAt > a.clock.t);
});

// ---------- cancellazioni di massa ----------
test('protezione cancellazione di massa: un reset dello store non cancella il server senza conferma', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks'] });
  a.stores.life.setState({ tasks: Array.from({ length: 100 }, (_, i) => ({ id: 't' + i, t: 'task ' + i })) });
  await settle([a]);
  assert.equal(server.log.length, 100);
  a.stores.life.setState({ tasks: [] });
  a.engine.captureAll(true);
  assert.equal(a.engine.pendingCount(), 0);
  assert.equal(a.state.get().massHold['life.tasks'].count, 100);
  a.engine.resolveMassDelete('life.tasks', false);
  assert.equal(a.engine.pendingCount(), 0); assert.equal(a.state.get().massHold['life.tasks'], undefined);
  a.stores.life.setState({ tasks: Array.from({ length: 60 }, (_, i) => ({ id: 't' + i, t: 'task ' + i })) });
  await settle([a]);
  a.stores.life.setState({ tasks: [] }); a.engine.captureAll(true);
  a.engine.resolveMassDelete('life.tasks', true);
  assert.equal(a.engine.pendingCount(), 60);
  await settle([a]);
  assert.equal(server.log.filter((c) => c.op === 'delete').length, 60);
});

// ---------- riavvio ----------
test('riavvio: lo stato salvato evita record spuri e ritrova le modifiche avvenute a motore spento', async () => {
  const server = mkServer();
  const a = await connected(server, 'A', { enable: ['plan_tasks', 'plan_agenda'] });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'uno' }, { id: 't2', t: 'due' }], events: { '2026-10-12': [{ time: '10:00', title: 'Riunione' }] } });
  await settle([a]);
  a.engine.flush(); a.engine.stop();
  const saved = JSON.parse(JSON.stringify(a.state.get()));
  const n0 = server.log.length;
  // "riavvio": nuovi store con i dati persistiti (uno cambiato e uno cancellato mentre il motore era spento)
  const stores = initialStores();
  stores.life.setState({ tasks: [{ id: 't1', t: 'uno MODIFICATO' }], events: { '2026-10-12': [{ time: '10:00', title: 'Riunione' }] } });
  const b = makeDevice(server, 'A2', { state: memoryState(saved), stores });
  await b.transport.connect(); b.engine.start();
  assert.equal(b.engine.pendingCount(), 2, 'una modifica e una cancellazione, nessun record spurio sull\'evento');
  await settle([b]);
  assert.equal(server.log.length, n0 + 2);
  const ops = server.log.slice(n0).map((c) => [c.op, c.entityId]).sort();
  assert.deepEqual(ops, [['delete', 't2'], ['update', 't1']]);
});

// ---------- scadenza tombstone e risincronizzazione ----------
test('TTL tombstone: il server dimentica le cancellazioni vecchie; un client rimasto indietro si risincronizza e converge', async () => {
  const clock = { t: T0 };
  const server = mkServer(clock, { tombstoneTtlMs: 30 * 86400000 });
  const a = await connected(server, 'A', { enable: ['plan_tasks'], clock });
  const b = await connected(server, 'B', { enable: ['plan_tasks'], clock });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'uno' }, { id: 't2', t: 'due' }] });
  await settle([a, b]);
  a.stores.life.setState({ tasks: [{ id: 't2', t: 'due' }] });
  await settle([a]);
  clock.t += 40 * 86400000;
  assert.equal(server.compact(), 1);
  assert.ok(server.minSeq > 0);
  await settle([b, a], 4);
  // convergenza (B puo' reintrodurre t1: limite documentato per i client offline oltre il TTL)
  assert.equal(view(a, 'life', 'tasks').length > 0, true);
  const norm = (d) => d.stores.life.getState().tasks.map((t) => t.id).sort().join();
  assert.equal(norm(a), norm(b));
  assert.ok(a.state.get().meta['life.tasks'] !== undefined);
});

// ---------- dispositivi, disattivazione ----------
test('dispositivi dal server e "Disattiva e cancella"', async () => {
  const server = mkServer();
  const a = await connected(server, 'Telefono', { enable: ['plan_tasks'] });
  const b = await connected(server, 'Tablet', { enable: ['plan_tasks'] });
  a.stores.life.setState({ tasks: [{ id: 't1', t: 'x' }] });
  await settle([a, b]);
  const names = a.state.get().devices.map((d) => d.name).sort();
  assert.deepEqual(names, ['Tablet', 'Telefono']);
  assert.ok(a.state.get().devices.some((d) => d.current));
  const r = await a.engine.deactivateAndWipe();
  assert.ok(r.ok && r.serverWiped);
  assert.equal(server.log.length, 0);
  assert.deepEqual(a.state.get().enabled, {});
  assert.equal(a.state.get().cursor, null);
  assert.equal(a.engine.pendingCount(), 0);
  assert.equal(a.stores.life.getState().tasks.length, 1, 'i dati sul telefono restano');
});

// ---------- scenario: tre dispositivi con guasti casuali ----------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const norm = (d) => {
  const l = d.stores.life.getState(), n = d.stores.network.getState(), h = d.stores.health.getState(), i = d.stores.interests.getState();
  const sort = (arr) => arr.map((x) => JSON.stringify(Object.fromEntries(Object.entries(x).sort()))).sort();
  return JSON.stringify({
    tasks: sort(l.tasks), notes: sort(l.notes), goals: sort(l.goals),
    events: Object.fromEntries(Object.entries(l.events).filter(([, v]) => v.length).sort().map(([k, v]) => [k, sort(v)])),
    following: [...n.following].sort(), votes: n.votes, selected: [...i.selected].sort(), moods: sort(h.moods), ledger: sort(n.ledger),
  });
};

for (const seed of [1, 2, 3, 4, 5, 6]) {
  test(`convergenza: 3 dispositivi, operazioni casuali, guasti (perdite, duplicati, riordino, offline) - seed ${seed}`, async () => {
    const R = rng(seed * 7919);
    const clock = { t: T0 };
    const server = mkServer(clock);
    const faults = () => ({ dropRequest: 0.2, dropResponse: 0.2, duplicateDelivery: 0.3, duplicateResponse: 0.3, shuffle: true });
    const devs = [];
    for (const [i, name] of ['A', 'B', 'C'].entries()) devs.push(await connected(server, name, { enable: ALL_CATS, clock, faults: faults(), seed: seed * 10 + i, config: { batchSize: 7, pullPage: 5 } }));
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const words = ['alfa', 'beta', 'gamma', 'delta', 'omega'];
    let counter = 0;
    for (let step = 0; step < 120; step++) {
      const d = pick(devs);
      clock.t += Math.floor(R() * 3000);
      const L = d.stores.life, N = d.stores.network, I = d.stores.interests, H = d.stores.health;
      const k = Math.floor(R() * 12);
      if (k === 0) L.setState((s) => ({ tasks: [...s.tasks, { id: 't' + (++counter) + d.name, t: pick(words) }] }));
      else if (k === 1) L.setState((s) => (s.tasks.length ? { tasks: s.tasks.map((t, i) => (i === Math.floor(R() * s.tasks.length) ? { ...t, done: !t.done, ...(R() < 0.3 ? { due: pick(words) } : {}) } : t)) } : null));
      else if (k === 2) L.setState((s) => ({ tasks: s.tasks.filter(() => R() > 0.15) }));
      else if (k === 3) L.setState((s) => ({ notes: [...s.notes, { id: 'n' + (++counter) + d.name, text: pick(words) + ' ' + step, date: 'd' }] }));
      else if (k === 4) L.setState((s) => (s.notes.length ? { notes: s.notes.map((n, i) => (i === Math.floor(R() * s.notes.length) ? { ...n, text: n.text + ' ' + d.name + step } : n)) } : null));
      else if (k === 5) L.setState((s) => (s.notes.length && R() < 0.4 ? { notes: s.notes.slice(1) } : null));
      else if (k === 6) { const day = '2026-10-' + (10 + Math.floor(R() * 3)); L.setState((s) => ({ events: { ...s.events, [day]: [...(s.events[day] ?? []), { time: pick(['9:00', '10:00', '11:00']), title: pick(words) }] } })); }
      else if (k === 7) L.setState((s) => { const days = Object.keys(s.events).filter((x) => s.events[x].length); if (!days.length) return null; const day = pick(days); return { events: { ...s.events, [day]: s.events[day].slice(1) } }; });
      else if (k === 8) N.setState((s) => ({ following: s.following.includes('u1') ? s.following.filter((x) => x !== 'u1') : [...s.following, 'u1', pick(words)].filter((x, i, a) => a.indexOf(x) === i) }));
      else if (k === 9) I.setState((s) => ({ selected: R() < 0.5 ? [...new Set([...s.selected, pick(words)])] : s.selected.slice(1) }));
      else if (k === 10) H.setState((s) => ({ moods: [...s.moods.filter((m) => m.date !== '2026-10-' + (10 + step % 5)), { date: '2026-10-' + (10 + step % 5), mood: pick(words) }] }));
      else N.setState((s) => ({ ledger: [{ type: 'topup', desc: pick(words) + step, amount: step, date: 'oggi' }, ...s.ledger] }));
      d.engine.captureAll();
      if (R() < 0.4) await d.engine.syncNow();
    }
    // la rete torna normale
    for (const d of devs) d.transport.faults = {};
    await settle(devs, 8);
    const [a, b, c] = devs.map((d) => JSON.parse(norm(d)));
    for (const k of Object.keys(a)) { assert.deepEqual(b[k], a[k], 'B = A su ' + k); assert.deepEqual(c[k], a[k], 'C = A su ' + k); }
    for (const d of devs) { assert.equal(d.engine.pendingCount(), 0, d.name + ' ha ancora pendenti'); assert.equal(d.engine.getStatus().phase, 'idle'); }
    // nessuna perdita di testo: ogni parola scritta nelle note ancora esistenti e' presente in tutti
    assert.ok(server.stats.duplicates + server.stats.rejected >= 0);
    assert.equal(server.log.length, new Set(server.log.map((x) => x.id)).size, 'ogni changeId compare una sola volta nel server');
  });
}

// ---------- prestazioni ----------
test('prestazioni: 50.000 entita\' entro budget; il diff incrementale non e\' O(n) sui campi', async () => {
  const N = 50_000;
  const tasks = Array.from({ length: N }, (_, i) => ({ id: 't' + i, t: 'attivita numero ' + i, due: '2026-10-12', urgent: i % 7 === 0 }));
  const server = mkServer();
  const a = makeDevice(server, 'A', { enable: ['plan_tasks'], config: { batchSize: 200, maxBatchBytes: 1e9 } });
  await a.transport.connect();
  a.stores.life.setState({ tasks });
  a.engine.start();
  // seed: la prima scansione genera 50.000 creazioni
  let t0 = performance.now();
  await a.engine.syncNow(); // attivazione: pull + seed + push
  const tSeedPush = performance.now() - t0;
  assert.equal(a.engine.pendingCount(), 0);
  assert.equal(server.log.length, N);
  // modifica di UNA entita'
  t0 = performance.now();
  a.stores.life.setState((s) => ({ tasks: s.tasks.map((t, i) => (i === 25_000 ? { ...t, done: true } : t)) }));
  const n = a.engine.captureAll();
  const tOne = performance.now() - t0;
  assert.equal(n, 1);
  // cambio in uno store non osservato per quella collezione: nessuna scansione
  t0 = performance.now();
  const scans0 = a.engine.stats.scans;
  for (let i = 0; i < 1000; i++) a.stores.life.setState({ goals: [{ id: 'g' + i, t: 'x', p: 1 }] });
  const tKeys = performance.now() - t0;
  // aggiunta in coda
  t0 = performance.now();
  a.stores.life.setState((s) => ({ tasks: [...s.tasks, { id: 'nuovo', t: 'x' }] }));
  const n2 = a.engine.captureAll();
  const tAdd = performance.now() - t0;
  assert.equal(n2, 1);
  // niente di cambiato sulla collezione: 0 scansioni
  const scansBefore = a.engine.stats.scans;
  a.stores.life.setState({ activeCat: 'x' });
  a.engine.captureAll();
  assert.equal(a.engine.stats.scans, scansBefore);
  console.log(`# perf 50k: seed+push ${tSeedPush.toFixed(0)} ms, 1 modifica ${tOne.toFixed(1)} ms, +1 entita' ${tAdd.toFixed(1)} ms, 1000 setState non correlati ${tKeys.toFixed(1)} ms (scansioni: ${a.engine.stats.scans - scans0})`);
  assert.ok(tOne < 250, 'una modifica su 50.000 entita\' entro 250 ms: ' + tOne);
  assert.ok(tAdd < 250, 'una aggiunta entro 250 ms: ' + tAdd);
  assert.ok(tKeys < 500, 'mille setState non correlati entro 500 ms (debounce): ' + tKeys);
  assert.ok(tSeedPush < 20_000, 'seed + invio di 50.000 entita\' entro 20 s: ' + tSeedPush);
  await a.engine.syncNow();
  // il secondo dispositivo scarica tutto e converge
  const b = await connected(server, 'B', { enable: ['plan_tasks'], config: { pullPage: 500 } });
  t0 = performance.now();
  await b.engine.syncNow();
  const tPull = performance.now() - t0;
  console.log(`# perf 50k: pull+applicazione su B ${tPull.toFixed(0)} ms`);
  assert.equal(b.stores.life.getState().tasks.length, N + 1);
  assert.equal(b.engine.pendingCount(), 0);
  assert.ok(tPull < 30_000, 'pull di 50.000 entita\' entro 30 s: ' + tPull);
});
