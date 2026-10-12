// Test di migrazione e regressione dei dati su fixture congelate (stato "versione 0" = AsyncStorage prima dell'engine SQLite).
//   node --experimental-strip-types --test tests/migration/migration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { openNodeDriver } from '../helpers/nodeSqlite.mjs';
import { SqlKvBackend } from '../../src/db/sqlKv.ts';
import { KvEngine } from '../../src/db/engine.ts';
import { runLegacyMigration } from '../../src/db/legacyMigration.ts';
import { prepareStored, specFor, CURRENT_SCHEMA_VERSION } from '../../src/db/migrations.ts';
import { SCHEMAS } from '../../src/db/schemas.ts';
import { validateBackup, buildBackup, serializeBackup, toStorageEntries, BACKUP_FORMAT } from '../../src/lib/backupCore.ts';
import { loadStateV0, loadBackupV1Text, clone, fakeAsyncStorage } from './_load.mjs';

const V0 = loadStateV0();
const names = Object.keys(V0);
const mkBackend = () => { const { driver } = openNodeDriver(); return new SqlKvBackend({ driver, bakIntervalMs: 0 }); };

test('fixture: stato v0 presente, in formato AsyncStorage e a versione 0', () => {
  assert.ok(names.length >= 15, 'servono molti store');
  for (const k of ['lp2-app', 'lp2-life', 'lp2-health', 'lp2-finance', 'lp2-chat', 'lp2-network']) assert.ok(V0[k], k);
  for (const [k, raw] of Object.entries(V0)) {
    assert.ok(k.startsWith('lp2-'));
    const p = JSON.parse(raw);
    assert.equal(p.version, 0, k);
    assert.equal(typeof p.state, 'object', k);
  }
});

test('ogni store v0 si porta alla versione corrente senza perdere nulla', () => {
  for (const [k, raw] of Object.entries(V0)) {
    const stored = JSON.parse(raw);
    const r = prepareStored(k, clone(stored));
    assert.equal(r.ok, true, k);
    assert.equal(r.value.version, specFor(k).version, `${k}: versione corrente`);
    assert.equal(r.value.version, CURRENT_SCHEMA_VERSION);
    assert.equal(r.future, false);
    assert.deepEqual(r.report.dropped, [], `${k}: nessun campo scartato`);
    assert.equal(r.report.filtered, 0, `${k}: nessun elemento scartato`);
    assert.deepEqual(r.value.state, stored.state, `${k}: stato identico (nessuna perdita di campi)`);
  }
});

test('tipi corretti dopo la migrazione: i campi dello schema mantengono il tipo atteso', () => {
  for (const [k, raw] of Object.entries(V0)) {
    const schema = SCHEMAS[k.replace('lp2-', '')];
    if (!schema) continue;
    const { state } = prepareStored(k, JSON.parse(raw)).value;
    for (const [field, spec0] of Object.entries(schema)) {
      if (!(field in state)) continue;
      const kind = typeof spec0 === 'string' ? spec0 : spec0.kind;
      const v = state[field];
      if (v === null) continue;
      if (kind === 'array') assert.ok(Array.isArray(v), `${k}.${field} array`);
      else if (kind === 'object') assert.ok(v && typeof v === 'object' && !Array.isArray(v), `${k}.${field} object`);
      else if (kind !== 'any') assert.equal(typeof v, kind, `${k}.${field}`);
    }
  }
  // campi sconosciuti (scritti da versioni passate) non vanno persi
  assert.equal(prepareStored('lp2-app', JSON.parse(V0['lp2-app'])).value.state.legacyFlag, 'conservami');
});

test('idempotenza: migrare due volte da lo stesso risultato', () => {
  for (const [k, raw] of Object.entries(V0)) {
    const once = prepareStored(k, JSON.parse(raw)).value;
    const twice = prepareStored(k, clone({ state: once.state, version: once.version }));
    assert.equal(twice.ok, true);
    assert.deepEqual(twice.value, once, k);
    assert.equal(twice.migratedFrom, undefined, `${k}: nessuna migrazione la seconda volta`);
  }
});

test('backup v1 congelato: si valida, anteprima coerente, round trip identico', () => {
  const text = loadBackupV1Text();
  const v = validateBackup(text);
  assert.equal(v.ok, true, v.error);
  assert.equal(v.backup.format, BACKUP_FORMAT);
  assert.equal(v.preview.storeCount, names.length);
  assert.deepEqual(v.preview.repaired, []);
  assert.ok(v.preview.totalItems > 100);
  assert.equal(v.backup.createdAt, '2026-01-15T10:00:00.000Z');
  for (const k of names) {
    assert.equal(v.backup.stores[k].version, specFor(k).version, k);
    assert.deepEqual(v.backup.stores[k].state, JSON.parse(V0[k]).state, `${k}: dati identici`);
  }
  // serializza di nuovo e rivalida: stesso risultato
  const again = validateBackup(serializeBackup(v.backup));
  assert.equal(again.ok, true);
  assert.deepEqual(again.backup.stores, v.backup.stores);
  // ripristino: le voci da scrivere sono ricostruibili e rileggibili
  for (const [k, json] of toStorageEntries(v.backup)) assert.deepEqual(JSON.parse(json).state, JSON.parse(V0[k]).state);
});

test('backup: versioni future rifiutate (formato e schema di uno store)', () => {
  const b = JSON.parse(loadBackupV1Text());
  const fmt = validateBackup(JSON.stringify({ ...b, format: BACKUP_FORMAT + 1 }));
  assert.equal(fmt.ok, false); assert.match(fmt.error, /più recente/);
  const sch = clone(b); sch.stores['lp2-life'].version = CURRENT_SCHEMA_VERSION + 1;
  const r = validateBackup(JSON.stringify(sch));
  assert.equal(r.ok, false); assert.match(r.error, /più recente/);
});

test('backup: dati corrotti vengono riparati o rifiutati, mai accettati a meta\'', () => {
  const b = JSON.parse(loadBackupV1Text());
  const bad = clone(b);
  bad.stores['lp2-life'].state.tasks = 'non un array';          // tipo sbagliato -> campo scartato
  bad.stores['lp2-life'].state.notes = [{ id: 'ok' }, 5, null];   // elementi non oggetto -> filtrati
  bad.stores['lp2-finance'].state.months = [];                    // nonEmpty -> scartato
  bad.stores['lp2-health'].state.lastSync = 'ieri';               // numero atteso
  const r = validateBackup(JSON.stringify(bad));
  assert.equal(r.ok, true, r.error);
  assert.ok(r.preview.repaired.includes('life') && r.preview.repaired.includes('finance') && r.preview.repaired.includes('health'));
  const life = r.backup.stores['lp2-life'].state;
  assert.equal('tasks' in life, false);
  assert.deepEqual(life.notes, [{ id: 'ok' }]);
  assert.deepEqual(life.goals, JSON.parse(V0['lp2-life']).state.goals, 'i campi validi restano');
  // forme irrecuperabili
  for (const mutate of [
    (x) => { x.stores['lp2-life'] = 5; },
    (x) => { x.stores['lp2-life'] = { state: [] }; },
    (x) => { x.stores['lp2-life'] = { state: 'x' }; },
    (x) => { delete x.stores['lp2-app']; },
    (x) => { x.stores = []; },
    (x) => { x.stores['chiave-senza-prefisso'] = { state: {} }; },
  ]) { const x = clone(b); mutate(x); assert.equal(validateBackup(JSON.stringify(x)).ok, false); }
  // blob non JSON / troncato
  const txt = loadBackupV1Text();
  assert.equal(validateBackup(txt.slice(0, txt.length >> 1)).ok, false);
  assert.equal(validateBackup('').ok, false);
});

test('prepareStored: input malformati non lanciano mai', () => {
  for (const x of [null, undefined, 5, 'x', [], {}, { state: null }, { state: [] }, { state: {}, version: 'a' }, { state: {}, version: NaN }, { state: { tasks: 3 }, version: -4 }]) {
    assert.doesNotThrow(() => prepareStored('lp2-life', x));
  }
  assert.equal(prepareStored('lp2-life', { state: {}, version: 'a' }).ok, true); // versione illeggibile = 0
  assert.equal(prepareStored('lp2-life', { state: [] }).ok, false);
  const fut = prepareStored('lp2-life', { state: { tasks: [] }, version: 99 });
  assert.equal(fut.ok, true); assert.equal(fut.future, true); assert.equal(fut.value.version, 99, 'la versione futura non viene "abbassata"');
});

test('engine end-to-end: AsyncStorage v0 -> SQLite -> rilettura identica, poi idempotente', async () => {
  const src = fakeAsyncStorage(V0);
  const b = mkBackend(); await b.init();
  const e = new KvEngine({ backend: b, notify: () => {}, beforeFirstRead: (be) => runLegacyMigration({ source: src, backend: be }).then(() => undefined) });
  for (const k of names) {
    const got = await e.getItem(k);
    assert.ok(got, k);
    assert.equal(got.version, specFor(k).version, k);
    assert.deepEqual(got.state, JSON.parse(V0[k]).state, `${k}: stesso contenuto`);
  }
  assert.equal(src.m.size, names.length, 'i vecchi dati restano finche\' non scade il periodo di tenuta');
  // seconda esecuzione: niente duplicati ne' modifiche
  assert.equal((await runLegacyMigration({ source: src, backend: b })).action, 'waiting');
  const snap = await b.readAll();
  assert.deepEqual(Object.keys(snap.values).sort(), names);
});

test('engine: un blob corrotto non blocca gli altri store (quarantena) e il resto resta intatto', async () => {
  const src = fakeAsyncStorage({ ...V0, 'lp2-prefs': '{non json', 'lp2-theia': JSON.stringify({ senza: 'state' }) });
  const b = mkBackend(); await b.init();
  const notes = [];
  const e = new KvEngine({ backend: b, notify: (n) => notes.push(n.kind), beforeFirstRead: (be) => runLegacyMigration({ source: src, backend: be }).then(() => undefined) });
  assert.equal(await e.getItem('lp2-prefs'), null);
  assert.equal(await e.getItem('lp2-theia'), null);
  for (const k of names.filter((n) => n !== 'lp2-prefs' && n !== 'lp2-theia')) {
    assert.deepEqual((await e.getItem(k)).state, JSON.parse(V0[k]).state, k);
  }
  assert.equal((await b.quarantineList()).length, 2);
});

test('engine: campi con tipo sbagliato vengono riparati e il resto dello store e\' mantenuto', async () => {
  const life = JSON.parse(V0['lp2-life']); life.state.tasks = 'rotto'; life.state.freeBuffer = 'molto';
  const src = fakeAsyncStorage({ ...V0, 'lp2-life': JSON.stringify(life) });
  const b = mkBackend(); await b.init();
  const e = new KvEngine({ backend: b, notify: () => {}, beforeFirstRead: (be) => runLegacyMigration({ source: src, backend: be }).then(() => undefined) });
  const got = await e.getItem('lp2-life');
  assert.ok(got);
  assert.equal('tasks' in got.state, false);
  assert.equal('freeBuffer' in got.state, false);
  assert.deepEqual(got.state.notes, JSON.parse(V0['lp2-life']).state.notes);
});

test('buildBackup -> validateBackup conserva ogni store v0 (nessuna chiave persa)', () => {
  const b = buildBackup(V0, '9.9.9', new Date('2030-01-01T00:00:00Z'));
  assert.deepEqual(Object.keys(b.stores).sort(), names);
  const v = validateBackup(serializeBackup(b));
  assert.equal(v.ok, true, v.error);
  assert.equal(v.preview.appVersion, '9.9.9');
});
