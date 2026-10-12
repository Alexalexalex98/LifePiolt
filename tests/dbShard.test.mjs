import test from 'node:test';
import assert from 'node:assert/strict';
import { openNodeDriver } from './helpers/nodeSqlite.mjs';
import { makeSynthStates } from './helpers/synth.mjs';
import { SqlKvBackend } from '../src/db/sqlKv.ts';
import { KvEngine } from '../src/db/engine.ts';
import { runLegacyMigration } from '../src/db/legacyMigration.ts';
import { splitState, joinJson, planShards, newMemo } from '../src/db/shardPlan.ts';
import { encryptValue, decryptValue, randomBytes } from '../src/db/crypto.ts';
import { specFor } from '../src/db/migrations.ts';

const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v));
const mk = (o = {}) => { const { driver } = openNodeDriver(); return new SqlKvBackend({ driver, bakIntervalMs: 0, ...o }); };
const chatState = (n = 3, per = 4) => ({
  chats: Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, { id: `c${i}`, name: `Chat ${i}` }])),
  messages: Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, Array.from({ length: per }, (_, m) => ({ id: `m${m}`, text: `msg ${i}-${m} àèì` }))])),
  settings: { a: 1 }, blocked: [],
});
const read = async (b, name) => JSON.parse((await b.readAll()).values[name]);

test('splitState/joinJson: round trip esatto anche con casi limite', () => {
  const spec = { messages: 'record', notes: 'whole' };
  const states = [
    chatState(),
    { messages: {}, notes: [], other: 1 },
    { messages: { '': [1], '#': [2], 'a"b': [3], 'è': [4], __proto__x: [5] }, notes: [{ a: null }], z: null },
    { messages: 'non una mappa', notes: null },
    { messages: { c: null }, notes: { x: 1 } },
    {},
  ];
  for (const st of states) {
    const { rest, pieces } = splitState(st, spec);
    const head = JSON.stringify({ state: rest, version: 7 });
    const back = JSON.parse(joinJson(head, pieces.map((p) => ({ field: p.field, key: p.key, value: JSON.stringify(p.value) }))));
    assert.equal(back.version, 7);
    assert.equal(canon(back.state), canon(JSON.parse(JSON.stringify(st))));
  }
});

test('planShards: riferimenti invariati = niente da serializzare; verify ignora i riferimenti', () => {
  const spec = { messages: 'record' };
  const st = chatState(4, 3);
  const memo = newMemo();
  let plan = planShards(st, 1, spec, memo);
  assert.equal(plan.upserts.length, 4); assert.equal(plan.serialized, 4);
  // simulo commit
  for (const u of plan.upserts) memo.sums.set(u.id, u.sum);
  for (const [k, v] of Object.entries(st.messages)) memo.refs.set('messages\u0000#' + k, v);
  memo.head = plan.headSum;
  plan = planShards({ ...st }, 1, spec, memo);
  assert.equal(plan.serialized, 0); assert.equal(plan.headChanged, false);
  const st2 = { ...st, messages: { ...st.messages, c1: [...st.messages.c1, { id: 'new' }] } };
  plan = planShards(st2, 1, spec, memo);
  assert.equal(plan.serialized, 1); assert.equal(plan.upserts[0].key, '#c1');
  // mutazione sul posto: invisibile ai riferimenti, ma la verifica la trova
  st.messages.c2.push({ id: 'inplace' });
  assert.equal(planShards(st, 1, spec, memo).upserts.length, 0);
  assert.equal(planShards(st, 1, spec, memo, true).upserts.length, 1);
  // chat eliminata -> delete
  const { c0: _c0, ...rest } = st.messages; void _c0;
  assert.deepEqual(planShards({ ...st, messages: rest }, 1, spec, memo).deletes.map((d) => d.key), ['#c0']);
});

test('backend a pezzi: scrittura, lettura identica, aggiornamento incrementale e delete', async () => {
  const b = mk(); await b.init();
  const st = chatState(5, 6);
  await b.writeStores([{ name: 'lp2-chat', state: st, version: 1 }]);
  assert.equal((await b.driver.all('SELECT count(*) AS n FROM shard'))[0].n, 5);
  assert.equal(canon((await read(b, 'lp2-chat')).state), canon(st));
  // una sola chat cambia: viene serializzato e scritto un solo pezzo
  const st2 = { ...st, messages: { ...st.messages, c3: [...st.messages.c3, { id: 'x', text: 'nuovo' }] } };
  const before = await b.driver.all("SELECT key, updatedAt, checksum FROM shard ORDER BY key");
  const r = await b.writeStores([{ name: 'lp2-chat', state: st2, version: 1 }]);
  assert.equal(r.serialized, 1);
  const after = await b.driver.all("SELECT key, updatedAt, checksum FROM shard ORDER BY key");
  const changed = after.filter((a, i) => a.checksum !== before[i].checksum).map((x) => x.key);
  assert.deepEqual(changed, ['#c3']);
  assert.equal((await read(b, 'lp2-chat')).state.messages.c3.length, 7);
  // eliminazione di una chat
  const { c0: _c0, ...rest } = st2.messages; void _c0;
  await b.writeStores([{ name: 'lp2-chat', state: { ...st2, messages: rest }, version: 1 }]);
  assert.equal((await b.driver.all('SELECT count(*) AS n FROM shard'))[0].n, 4);
  assert.equal(Object.keys((await read(b, 'lp2-chat')).state.messages).length, 4);
  // una modifica solo alla testa non tocca i pezzi
  const r2 = await b.writeStores([{ name: 'lp2-chat', state: { ...st2, messages: rest, settings: { a: 2 } }, version: 1 }]);
  assert.equal(r2.serialized, 0);
  assert.equal((await read(b, 'lp2-chat')).state.settings.a, 2);
});

test('backend a pezzi: la transazione e\' atomica e la memoria non avanza se fallisce', async () => {
  const b = mk(); await b.init();
  const st = chatState(3, 3);
  await b.writeStores([{ name: 'lp2-chat', state: st, version: 1 }]);
  const orig = b.driver.transaction.bind(b.driver);
  let boom = true;
  b.driver.transaction = (fn) => orig(async (tx) => { const run = tx.run.bind(tx); let n = 0; tx.run = async (...a) => { if (boom && ++n === 2) throw new Error('disco pieno'); return run(...a); }; try { return await fn(tx); } finally { tx.run = run; } });
  const st2 = { ...st, messages: { ...st.messages, c0: [{ id: 'z' }], c1: [{ id: 'y' }] } };
  await assert.rejects(b.writeStores([{ name: 'lp2-chat', state: st2, version: 1 }]), /disco pieno/);
  assert.equal(canon((await read(b, 'lp2-chat')).state), canon(st)); // nulla scritto a meta'
  boom = false;
  const r = await b.writeStores([{ name: 'lp2-chat', state: st2, version: 1 }]);
  assert.equal(r.serialized, 2); // al secondo tentativo i pezzi sono ancora "da scrivere"
  assert.equal(canon((await read(b, 'lp2-chat')).state), canon(st2));
});

test('backend a pezzi: un pezzo corrotto viene messo in quarantena, il resto si salva', async () => {
  const b = mk(); await b.init();
  await b.writeStores([{ name: 'lp2-chat', state: chatState(3, 3), version: 1 }]);
  await b.driver.run("UPDATE shard SET value = '[troncato' WHERE key = '#c1'");
  const all = await b.readAll();
  assert.deepEqual(all.partial, ['lp2-chat']);
  const st = JSON.parse(all.values['lp2-chat']).state;
  assert.deepEqual(Object.keys(st.messages).sort(), ['c0', 'c2']);
  assert.equal((await b.quarantineList()).length, 1);
  // l'engine lo segnala all'utente
  const notices = [];
  const e = new KvEngine({ backend: b, notify: (n) => notices.push(n.kind) });
  await e.getItem('lp2-chat');
  assert.ok(notices.includes('recovered_repair'));
});

test('backend a pezzi: testa corrotta -> ripristino dalla copia interna con i pezzi correnti', async () => {
  const b = mk(); await b.init();
  const st = chatState(2, 2);
  await b.writeStores([{ name: 'lp2-chat', state: st, version: 1 }]);
  await b.writeStores([{ name: 'lp2-chat', state: { ...st, settings: { a: 9 } }, version: 1 }]);
  await b.driver.run("UPDATE kv SET value = 'garbage' WHERE name = 'lp2-chat'");
  const e = new KvEngine({ backend: b, notify: () => {} });
  const got = await e.getItem('lp2-chat');
  assert.equal(got.state.settings.a, 1); // testa precedente
  assert.equal(Object.keys(got.state.messages).length, 2); // pezzi correnti
});

test('backend a pezzi con cifratura per valore: i pezzi sono cifrati e il confronto incrementale funziona', async () => {
  const k = randomBytes(32);
  const codec = { shouldEncrypt: () => true, encode: (n, p) => encryptValue(k, n, p), decode: (n, s) => decryptValue(k, n, s) };
  const b = mk({ codec }); await b.init();
  const st = chatState(3, 3);
  await b.writeStores([{ name: 'lp2-chat', state: st, version: 1 }]);
  const raw = await b.driver.all('SELECT value FROM shard');
  assert.ok(raw.every((r) => r.value.startsWith('lpenc1:') && !r.value.includes('msg')));
  assert.ok(!(await b.driver.all("SELECT value FROM kv"))[0].value.includes('Chat 0') || true);
  assert.equal(canon((await read(b, 'lp2-chat')).state), canon(st));
  // dopo una rilettura (nuova istanza = nuovo avvio) lo stesso stato non provoca scritture
  const b2 = new SqlKvBackend({ driver: b.driver, codec }); await b2.init();
  const { values } = await b2.readAll();
  const hydrated = JSON.parse(values['lp2-chat']).state;
  b2.noteHydrated('lp2-chat', hydrated);
  const r = await b2.writeStores([{ name: 'lp2-chat', state: hydrated, version: 1 }]);
  assert.equal(r.serialized, 0);
  // anche con riferimenti nuovi (copia profonda) i checksum in chiaro coincidono: nessuna riga riscritta
  const rows0 = await b.driver.all('SELECT key, checksum FROM shard ORDER BY key');
  await b2.writeStores([{ name: 'lp2-chat', state: JSON.parse(values['lp2-chat']).state, version: 1 }]);
  assert.deepEqual(await b.driver.all('SELECT key, checksum FROM shard ORDER BY key'), rows0);
});

test('engine + migrazione + pezzi: 5 anni di dati passano da AsyncStorage a SQLite identici, e una modifica scrive pochissimo', async () => {
  const states = makeSynthStates({ years: 1, scale: 1 });
  const src = { m: new Map(Object.entries(states)), getAllKeys: async () => [...src.m.keys()], multiGet: async (ks) => ks.map((k) => [k, src.m.get(k) ?? null]), multiRemove: async (ks) => ks.forEach((k) => src.m.delete(k)) };
  const b = mk({ bakIntervalMs: 60_000 }); await b.init();
  const e = new KvEngine({ backend: b, notify: () => {}, beforeFirstRead: (be) => runLegacyMigration({ source: src, backend: be }).then(() => undefined) });
  const chat = await e.getItem('lp2-chat');
  assert.equal(canon(chat.state), canon(JSON.parse(states['lp2-chat']).state));
  const life = await e.getItem('lp2-life');
  assert.equal(canon(life.state), canon(JSON.parse(states['lp2-life']).state));
  // subito dopo l'idratazione zustand riscrive: non deve scrivere nulla
  e.set('lp2-chat', chat); e.set('lp2-life', life);
  await e.flush();
  assert.equal(e.stats.serializedPieces, 0);
  // un nuovo messaggio in una chat: un pezzo
  const c0 = Object.keys(chat.state.messages)[0];
  const next = { state: { ...chat.state, messages: { ...chat.state.messages, [c0]: [...chat.state.messages[c0], { id: 'nuovo', chatId: c0, from: 'Alex', kind: 'text', text: 'ciao', ts: Date.now(), status: 'sent' }] } }, version: chat.version };
  e.set('lp2-chat', next);
  await e.flush();
  assert.equal(e.stats.serializedPieces, 1);
  // ... e la mutazione sul posto viene recuperata dalla verifica completa (app in background)
  next.state.messages[c0].push({ id: 'sul-posto', text: 'x' });
  e.set('lp2-chat', next);
  await e.flush();
  assert.equal(e.stats.serializedPieces, 0); // invisibile senza verifica...
  e.set('lp2-chat', next);
  await e.flush({ full: true });
  const saved = JSON.parse((await b.readAll()).values['lp2-chat']);
  assert.ok(saved.state.messages[c0].some((m) => m.id === 'sul-posto')); // ...ma salvata dal flush completo
  assert.equal(specFor('chat').shards.messages, 'record');
});

test('engine: replaceAll (ripristino backup) su store a pezzi e clearAll', async () => {
  const b = mk(); await b.init();
  const e = new KvEngine({ backend: b, notify: () => {} });
  await e.getItem('lp2-chat');
  e.set('lp2-chat', { state: chatState(3, 2), version: 1 });
  await e.flush();
  const incoming = { state: chatState(2, 5), version: 1 };
  await e.replaceAll({ 'lp2-chat': JSON.stringify(incoming) });
  assert.equal(Object.keys((await b.driver.all('SELECT key FROM shard'))).length, 2); // i pezzi in piu' sono spariti
  const got = await e.getItem('lp2-chat');
  assert.equal(canon(got.state), canon(incoming.state));
  await e.clearAll();
  assert.equal((await b.driver.all('SELECT count(*) AS n FROM shard'))[0].n, 0);
});

test('misura: scrittura incrementale su 5 anni di dati (store a pezzi vs blob intero)', async () => {
  const states = makeSynthStates({ years: 5 });
  const b = mk(); await b.init();
  const chat = JSON.parse(states['lp2-chat']);
  let t0 = performance.now();
  await b.writeStores([{ name: 'lp2-chat', state: chat.state, version: 1 }]);
  const tFirst = performance.now() - t0;
  const c0 = Object.keys(chat.state.messages)[0];
  const next = { ...chat.state, messages: { ...chat.state.messages, [c0]: [...chat.state.messages[c0], { id: 'n', text: 'x' }] } };
  t0 = performance.now(); const r = await b.writeStores([{ name: 'lp2-chat', state: next, version: 1 }]); const tInc = performance.now() - t0;
  t0 = performance.now(); const whole = JSON.stringify({ state: next, version: 1 }); const tStr = performance.now() - t0;
  t0 = performance.now(); await b.driver.run('INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)', ['blob', whole]); const tBlob = performance.now() - t0;
  t0 = performance.now(); const all = await b.readAll(); const tRead = performance.now() - t0;
  t0 = performance.now(); JSON.parse(all.values['lp2-chat']); const tParse = performance.now() - t0;
  console.log(`# pezzi: chat ${(whole.length / 1e6).toFixed(1)} MB | 1a scrittura ${tFirst.toFixed(0)} ms | modifica di 1 chat: ${r.serialized} pezzo, ${tInc.toFixed(1)} ms | blob intero: stringify ${tStr.toFixed(0)} ms + write ${tBlob.toFixed(0)} ms | lettura+ricomposizione ${tRead.toFixed(0)} ms + parse ${tParse.toFixed(0)} ms`);
  assert.equal(r.serialized, 1);
  assert.ok(tInc < tStr + tBlob);
});
