import test from 'node:test';
import assert from 'node:assert/strict';
import { openNodeDriver } from './helpers/nodeSqlite.mjs';
import { SqlKvBackend } from '../src/db/sqlKv.ts';
import { AsyncKvBackend } from '../src/db/asyncKv.ts';
import { KvEngine } from '../src/db/engine.ts';
import { runLegacyMigration } from '../src/db/legacyMigration.ts';
import { checksum } from '../src/db/checksum.ts';
import { repairState } from '../src/db/schemaKit.ts';
import { prepareStored, registerStore, specFor } from '../src/db/migrations.ts';
import { SCHEMAS } from '../src/db/schemas.ts';
import { copyKvTables } from '../src/db/dbCopy.ts';
import { bytesToBase64, base64ToBytes, bytesToHex, hexToBytes } from '../src/db/base64.ts';

const enc = (state, version = 0) => JSON.stringify({ state, version });
const mkBackend = (o = {}) => { const { driver } = openNodeDriver(); return new SqlKvBackend({ driver, bakIntervalMs: 0, ...o }); };

/** timer finto: controllo manuale del tempo */
function fakeClock() {
  let now = 1_000_000; let id = 0; const timers = new Map();
  return {
    now: () => now,
    setTimer: (fn, ms) => { const h = ++id; timers.set(h, { at: now + ms, fn }); return h; },
    clearTimer: (h) => { timers.delete(h); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = Math.max(now, due[1].at); due[1].fn();
        await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
      }
      now = end;
    },
    pending: () => timers.size,
  };
}
const settle = async (ms = 20) => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, ms / 6)); };

test('base64/hex round trip e checksum', () => {
  for (const n of [0, 1, 2, 3, 4, 31, 32, 100]) { const b = new Uint8Array(n).map((_, i) => (i * 37 + 11) & 255); assert.deepEqual(base64ToBytes(bytesToBase64(b)), b); assert.deepEqual(hexToBytes(bytesToHex(b)), b); }
  assert.throws(() => base64ToBytes('@@@@'));
  assert.notEqual(checksum('abc'), checksum('abd'));
  assert.equal(checksum('abc'), checksum('abc'));
});

test('schemaKit: tiene i campi validi, scarta gli altri, filtra gli elementi', () => {
  const { state, report } = repairState({ tasks: [{ id: 1 }, 5, null, { id: 2 }], notes: 'rotto', goals: [], freeBuffer: 'x', events: { a: [1], b: 'no' }, extra: 1 }, SCHEMAS.life);
  assert.deepEqual(state.tasks, [{ id: 1 }, { id: 2 }]);
  assert.equal('notes' in state, false);
  assert.equal('freeBuffer' in state, false);
  assert.deepEqual(state.events, { a: [1] });
  assert.equal(state.extra, 1);
  assert.deepEqual(report.dropped.sort(), ['freeBuffer', 'notes']);
  assert.equal(report.filtered, 3);
  assert.equal(repairState('boh', SCHEMAS.life).report.fatal, true);
  assert.equal('months' in repairState({ months: [] }, SCHEMAS.finance).state, false); // mesi vuoti: lo store usa il suo valore iniziale
});

test('migrazioni: i dati esistenti (version 0) restano identici; versioni future non vengono perse', () => {
  const state = { tasks: [{ id: 'a', t: 'x', done: false }], notes: [] };
  const r = prepareStored('lp2-life', { state, version: 0 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.state, state);
  assert.equal(r.value.version, specFor('life').version);
  assert.equal(r.migratedFrom, 0);
  const fut = prepareStored('lp2-life', { state, version: 99 });
  assert.equal(fut.ok && fut.future, true);
  assert.equal(fut.value.version, 99);
  assert.equal(prepareStored('lp2-life', { nope: 1 }).ok, false);
  // migrazione di un nuovo store con versione 3
  registerStore('zz', { version: 3, migrations: { 2: (s) => ({ ...s, b: 2 }), 3: (s) => ({ ...s, c: s.b + 1 }) } });
  const m = prepareStored('lp2-zz', { state: { a: 1 }, version: 1 });
  assert.deepEqual(m.value.state, { a: 1, b: 2, c: 3 });
  assert.equal(m.value.version, 3);
});

test('SqlKvBackend: scrittura, lettura, checksum, copia interna e quarantena', async () => {
  const b = mkBackend(); await b.init();
  await b.writeMany({ 'lp2-prefs': enc({ tasks: [1] }), 'lp2-app': enc({ x: 1 }) }, { 'lp2-prefs': 1 });
  let all = await b.readAll();
  assert.deepEqual(Object.keys(all.values).sort(), ['lp2-app', 'lp2-prefs']);
  assert.equal(all.bad.length, 0);
  assert.equal(await b.readBackup('lp2-prefs'), null); // prima scrittura: nessun valore precedente
  await b.writeMany({ 'lp2-prefs': enc({ tasks: [1, 2] }) });
  assert.equal(JSON.parse(await b.readBackup('lp2-prefs')).state.tasks.length, 1); // la copia interna e' il valore precedente
  // corruzione: checksum non coincide -> "bad"
  await b.driver.run("UPDATE kv SET value = '{troncato' WHERE name = 'lp2-prefs'");
  all = await b.readAll();
  assert.deepEqual(all.bad, ['lp2-prefs']);
  await b.quarantine('lp2-prefs', '{troncato', 'test');
  assert.equal((await b.quarantineList()).length, 1);
  for (let i = 0; i < 8; i++) await b.quarantine('lp2-prefs', 'x' + i, 'test');
  assert.equal((await b.quarantineList()).length, 5); // tetto per store
  const s = await b.sizes(); assert.ok(s.every((x) => x.bytes > 0));
  const m = await b.maintain(true); assert.equal(m.vacuumed, true);
});

test('SqlKvBackend: la transazione e\' atomica (errore a meta\' = nessuna scrittura)', async () => {
  const b = mkBackend(); await b.init();
  await b.writeMany({ 'lp2-a': enc({ v: 1 }) });
  await assert.rejects(b.driver.transaction(async (tx) => { await tx.run("UPDATE kv SET value='x'"); throw new Error('boom'); }));
  assert.equal(JSON.parse((await b.readAll()).values['lp2-a']).state.v, 1);
});

test('engine: idratazione da una query, valore assente = null', async () => {
  const b = mkBackend(); await b.init();
  await b.writeMany({ 'lp2-prefs': enc({ tasks: [{ id: 'a' }] }, 1) });
  const e = new KvEngine({ backend: b });
  assert.equal((await e.getItem('lp2-prefs')).state.tasks[0].id, 'a');
  assert.equal(await e.getItem('lp2-theia'), null);
});

test('engine: scritture coalescenti con debounce (un solo write per store) e maxWait', async () => {
  const b = mkBackend(); await b.init();
  let calls = 0; const orig = b.writeMany.bind(b); b.writeMany = (...a) => { calls++; return orig(...a); };
  const c = fakeClock();
  const e = new KvEngine({ backend: b, ...c, debounceMs: 400, maxWaitMs: 3000 });
  await e.getItem('lp2-prefs');
  for (let i = 0; i < 200; i++) { e.set('lp2-prefs', { state: { tasks: new Array(i).fill({ id: 'x' }) }, version: 1 }); await c.advance(10); }
  // 2 secondi di modifiche continue: niente scritture finche' si e' sotto maxWait
  assert.equal(calls, 0);
  e.set('lp2-theia', { state: { chats: {} }, version: 1 });
  await c.advance(3500);
  await e.flush();
  assert.ok(calls >= 1 && calls <= 2, 'chiamate: ' + calls);
  assert.equal(JSON.parse((await b.readAll()).values['lp2-prefs']).state.tasks.length, 199); // vince l'ultimo
  // dopo il debounce si scrive una volta sola
  const before = calls;
  e.set('lp2-prefs', { state: { tasks: [] }, version: 1 }); e.set('lp2-prefs', { state: { tasks: [{ id: 'z' }] }, version: 1 });
  await c.advance(500); await settle();
  assert.equal(calls, before + 1);
  assert.equal(JSON.parse((await b.readAll()).values['lp2-prefs']).state.tasks[0].id, 'z');
});

test('engine: non riscrive un valore identico a quello su disco', async () => {
  const b = mkBackend(); await b.init();
  const state = { tasks: [{ id: 'a' }] };
  await b.writeMany({ 'lp2-prefs': JSON.stringify({ state, version: 1 }) });
  let calls = 0; const orig = b.writeMany.bind(b); b.writeMany = (...a) => { calls++; return orig(...a); };
  const e = new KvEngine({ backend: b });
  const got = await e.getItem('lp2-prefs');
  e.set('lp2-prefs', got); // zustand riscrive subito dopo l'idratazione
  await e.flush();
  assert.equal(calls, 0);
});

test('engine: errore di scrittura (disco pieno) -> avviso, dati in memoria, ritenta e salva', async () => {
  const b = mkBackend(); await b.init();
  const notices = []; const c = fakeClock();
  const e = new KvEngine({ backend: b, ...c, notify: (n) => notices.push(n), retryDelaysMs: [1000] });
  await e.ready();
  const orig = b.writeMany.bind(b); let fail = true;
  b.writeMany = async (...a) => { if (fail) throw new Error('database or disk is full (SQLITE_FULL)'); return orig(...a); };
  e.set('lp2-prefs', { state: { tasks: [{ id: 'keep' }] }, version: 1 });
  await e.flush();
  assert.ok(notices.some((n) => n.kind === 'disk_full'));
  assert.equal(e.hasPending(), true); // nulla perso
  fail = false;
  await c.advance(1500); await settle();
  assert.equal(e.hasPending(), false);
  assert.equal(JSON.parse((await b.readAll()).values['lp2-prefs']).state.tasks[0].id, 'keep');
});

test('engine: valore corrotto -> ultima copia valida + avviso; senza copia -> quarantena e null', async () => {
  const b = mkBackend(); await b.init();
  await b.writeMany({ 'lp2-prefs': enc({ tasks: [{ id: 'v1' }] }, 1) });
  await b.writeMany({ 'lp2-prefs': enc({ tasks: [{ id: 'v2' }] }, 1) });
  await b.driver.run("UPDATE kv SET value = 'garbage' WHERE name='lp2-prefs'"); // checksum non coincide
  const notices = [];
  const e = new KvEngine({ backend: b, notify: (n) => notices.push(n.kind) });
  const got = await e.getItem('lp2-prefs');
  assert.equal(got.state.tasks[0].id, 'v1');
  assert.ok(notices.includes('recovered_backup'));
  // senza copia
  const b2 = mkBackend(); await b2.init();
  await b2.writeMany({ 'lp2-theia': enc({ chats: {} }, 1) });
  await b2.driver.run("UPDATE kv SET value = 'garbage' WHERE name='lp2-theia'");
  const n2 = []; const e2 = new KvEngine({ backend: b2, notify: (n) => n2.push(n.kind) });
  assert.equal(await e2.getItem('lp2-theia'), null);
  assert.ok(n2.includes('quarantined'));
});

test('engine: JSON valido ma campi sbagliati -> riparazione per campo e blob in quarantena', async () => {
  const b = mkBackend(); await b.init();
  await b.writeMany({ 'lp2-life': enc({ tasks: [{ id: 'ok' }, 'rotto'], notes: 'non un array', goals: [{ id: 'g' }] }, 0) });
  const notices = []; const e = new KvEngine({ backend: b, notify: (n) => notices.push(n.kind) });
  const got = await e.getItem('lp2-life');
  assert.deepEqual(got.state.tasks, [{ id: 'ok' }]);
  assert.equal('notes' in got.state, false);
  assert.deepEqual(got.state.goals, [{ id: 'g' }]);
  assert.ok(notices.includes('recovered_repair'));
  await settle();
  const q = await b.quarantineList();
  assert.equal(q.length, 1); assert.match(q[0].reason, /notes/);
  await e.flush();
  assert.equal(JSON.parse((await b.readAll()).values['lp2-life']).version, specFor('life').version);
});

test('engine: JSON non valido -> quarantena, non crasha mai', async () => {
  const b = mkBackend(); await b.init();
  const bad = '{"state": {"tasks": [';
  await b.driver.run('INSERT INTO kv(name,value,version,updatedAt,checksum) VALUES(?,?,?,?,?)', ['lp2-life', bad, 1, 1, checksum(bad)]);
  const e = new KvEngine({ backend: b, notify: () => {} });
  assert.equal(await e.getItem('lp2-life'), null);
  assert.equal((await b.quarantineList()).length, 1);
});

test('engine: replaceAll, clearAll, snapshot includono le scritture non ancora flushate', async () => {
  const b = mkBackend(); await b.init();
  const e = new KvEngine({ backend: b });
  await e.getItem('lp2-x');
  e.set('lp2-a', { state: { v: 1 }, version: 1 });
  const snap = await e.snapshot();
  assert.equal(JSON.parse(snap['lp2-a']).state.v, 1);
  await e.replaceAll({ 'lp2-b': enc({ v: 2 }, 1) });
  assert.deepEqual(Object.keys((await b.readAll()).values), ['lp2-b']);
  assert.equal((await e.getItem('lp2-b')).state.v, 2);
  e.set('lp2-c', { state: { v: 3 }, version: 1 });
  await e.clearAll();
  await e.flush();
  assert.deepEqual((await b.readAll()).values, {});
});

// ---- migrazione da AsyncStorage ----
function fakeAsyncStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getAllKeys: async () => [...m.keys()],
    multiGet: async (ks) => ks.map((k) => [k, m.has(k) ? m.get(k) : null]),
    multiSet: async (es) => { for (const [k, v] of es) m.set(k, v); },
    multiRemove: async (ks) => { for (const k of ks) m.delete(k); },
  };
}
const REAL = {
  'lp2-app': enc({ onboarded: true, account: { name: 'Alex' } }),
  'lp2-life': enc({ tasks: [1, 2, 3].map((n) => ({ id: 't' + n, t: 'task ' + n, done: false })), notes: [{ id: 'n1', text: 'ciao' }] }),
  'lp2-finance': enc({ months: [{ label: 'x', movements: [] }], bills: [] }),
  'altra': 'x',
};

test('migrazione legacy: copia verificata, vecchi dati tenuti, idempotente, purge dopo N giorni', async () => {
  const src = fakeAsyncStorage(REAL);
  const b = mkBackend(); await b.init();
  let now = 1_000_000_000_000;
  const notes = [];
  const r1 = await runLegacyMigration({ source: src, backend: b, now: () => now, notify: (n) => notes.push(n.kind) });
  assert.equal(r1.action, 'copied'); assert.equal(r1.copied, 3);
  assert.deepEqual(Object.keys((await b.readAll()).values).sort(), ['lp2-app', 'lp2-finance', 'lp2-life']);
  assert.deepEqual(JSON.parse((await b.readAll()).values['lp2-life']), JSON.parse(REAL['lp2-life'])); // identico (lo store a pezzi ricompone gli stessi dati)
  assert.equal(src.m.size, 4); // i vecchi dati sono ancora li'
  assert.ok(notes.includes('migrated_legacy'));
  assert.equal((await runLegacyMigration({ source: src, backend: b, now: () => now + 86400000 })).action, 'waiting');
  assert.equal(src.m.size, 4);
  const r3 = await runLegacyMigration({ source: src, backend: b, now: () => now + 15 * 86400000 });
  assert.equal(r3.action, 'purged');
  assert.deepEqual([...src.m.keys()], ['altra']); // solo le chiavi lp2- vengono rimosse
  assert.equal((await runLegacyMigration({ source: src, backend: b })).action, 'already');
});

test('migrazione legacy: interrotta a meta\' e rilanciata non perde ne\' sovrascrive dati piu\' recenti', async () => {
  const src = fakeAsyncStorage(REAL);
  const b = mkBackend(); await b.init();
  // simulo: una copia parziale + una modifica nuova fatta dal nuovo engine prima che la migrazione finisse
  await b.writeMany({ 'lp2-app': REAL['lp2-app'], 'lp2-life': enc({ tasks: [{ id: 'nuovo' }] }, 1) });
  const orig = b.adoptMissing.bind(b);
  b.adoptMissing = async () => { throw new Error('app uccisa'); };
  await assert.rejects(runLegacyMigration({ source: src, backend: b }));
  assert.equal(await b.getMeta('legacy'), null); // niente marcatore: sara' rifatta
  b.adoptMissing = orig;
  const r = await runLegacyMigration({ source: src, backend: b });
  assert.equal(r.action, 'copied');
  assert.equal(JSON.parse((await b.readAll()).values['lp2-life']).state.tasks[0].id, 'nuovo'); // il dato nuovo vince
  assert.ok((await b.readAll()).values['lp2-finance']); // mancante: copiato
  assert.equal(r.copied, 1);
});

test('migrazione legacy: dati non-JSON vanno in quarantena e non bloccano gli altri', async () => {
  const src = fakeAsyncStorage({ ...REAL, 'lp2-rotto': '{non json', 'lp2-vuoto': JSON.stringify({ nope: 1 }) });
  const b = mkBackend(); await b.init();
  const r = await runLegacyMigration({ source: src, backend: b });
  assert.equal(r.action, 'copied');
  assert.equal(Object.keys((await b.readAll()).values).length, 3);
  assert.equal((await b.quarantineList()).length, 2);
});

test('migrazione legacy: nulla da migrare (installazione nuova)', async () => {
  const b = mkBackend(); await b.init();
  assert.equal((await runLegacyMigration({ source: fakeAsyncStorage({}), backend: b })).action, 'none');
  assert.equal((await runLegacyMigration({ source: fakeAsyncStorage(REAL), backend: b })).action, 'already');
});

test('migrazione legacy: dati reali del backup test attraversano engine e tornano uguali', async () => {
  const src = fakeAsyncStorage(REAL);
  const b = mkBackend(); await b.init();
  const e = new KvEngine({ backend: b, beforeFirstRead: (be) => runLegacyMigration({ source: src, backend: be }).then(() => undefined) });
  const life = await e.getItem('lp2-life');
  assert.equal(life.state.tasks.length, 3);
  assert.equal(life.version, specFor('life').version);
  assert.equal((await e.getItem('lp2-app')).state.account.name, 'Alex');
});

test('AsyncKvBackend: stesso formato di prima, coalescenza e flush', async () => {
  const src = fakeAsyncStorage(REAL);
  const b = new AsyncKvBackend(src);
  const e = new KvEngine({ backend: b });
  assert.equal((await e.getItem('lp2-life')).state.notes.length, 1);
  e.set('lp2-life', { state: { tasks: [], notes: [] }, version: 1 });
  e.set('lp2-new', { state: { a: 1 }, version: 1 });
  await e.flush();
  assert.deepEqual(JSON.parse(src.m.get('lp2-new')), { state: { a: 1 }, version: 1 });
  assert.equal(src.m.get('altra'), 'x');
  await e.clearAll();
  assert.deepEqual([...src.m.keys()], ['altra']);
});

test('copyKvTables: travaso non cifrato -> cifrato e verifica', async () => {
  const a = mkBackend(); await a.init();
  await a.writeMany({ 'lp2-prefs': enc({ tasks: [1] }, 1) }); await a.quarantine('lp2-prefs', 'x', 'r'); await a.setMeta('legacy', '{"phase":"purged"}');
  const bb = mkBackend(); await bb.init();
  assert.equal(await copyKvTables(a.driver, bb.driver), 1);
  assert.equal((await bb.readAll()).values['lp2-prefs'], enc({ tasks: [1] }, 1));
  assert.equal(await bb.getMeta('legacy'), '{"phase":"purged"}');
  assert.equal(await copyKvTables(a.driver, bb.driver), 1); // idempotente
});

test('DB: versione di schema futura rifiutata, user_version impostato', async () => {
  const { driver } = openNodeDriver();
  await driver.exec('PRAGMA user_version = 99');
  await assert.rejects(new SqlKvBackend({ driver }).init(), /pi.+recente/);
  const { driver: d2 } = openNodeDriver(); const b = new SqlKvBackend({ driver: d2 }); await b.init();
  assert.equal((await d2.all('PRAGMA user_version'))[0].user_version, 1);
});
