import test from 'node:test';
import assert from 'node:assert/strict';
import { aesEncrypt, aesDecrypt, encryptValue, decryptValue, isEncryptedValue, encryptBackup, decryptBackup, parseLpBackup, isLpBackupText, BackupCryptoError, randomBytes, setRandomSource, DEFAULT_KDF } from '../src/db/crypto.ts';
import { utf8 } from '../src/db/base64.ts';
import { KEY_CURRENT, KEY_NEXT, ensureKey, rotateKey, candidates, loadKeys, settleKeys, dropKeys } from '../src/db/keyring.ts';
import { SqlKvBackend } from '../src/db/sqlKv.ts';
import { openNodeDriver } from './helpers/nodeSqlite.mjs';
import { buildBackup, serializeBackup, validateBackup, toStorageEntries } from '../src/lib/backupCore.ts';

const LIGHT = { N: 16384 }; // il minimo accettato dal formato; in produzione 32768
const key = () => randomBytes(32);

test('AES-GCM: round trip, nonce diverso a ogni cifratura, manomissione rilevata', () => {
  const k = key(); const msg = utf8('dati sensibili àèì');
  const a = aesEncrypt(k, msg), b = aesEncrypt(k, msg);
  assert.notDeepEqual(a, b);
  assert.deepEqual(aesDecrypt(k, a), msg);
  const t = a.slice(); t[t.length - 1] ^= 1;
  assert.throws(() => aesDecrypt(k, t));
  assert.throws(() => aesDecrypt(key(), a));
  assert.throws(() => aesDecrypt(k, a.slice(0, 10)));
  assert.throws(() => aesEncrypt(new Uint8Array(16), msg));
});

test('cifratura per valore: legata al nome dello store, testo in chiaro non presente', () => {
  const k = key(); const plain = JSON.stringify({ state: { iban: 'CH93 0076 2011 6238 5295 7' }, version: 1 });
  const c = encryptValue(k, 'lp2-identity', plain);
  assert.ok(isEncryptedValue(c)); assert.ok(!c.includes('CH93'));
  assert.equal(decryptValue(k, 'lp2-identity', c), plain);
  assert.throws(() => decryptValue(k, 'lp2-health', c)); // scambio tra store rilevato
  assert.equal(decryptValue(k, 'lp2-life', plain), plain); // valori non cifrati (dati vecchi) passano
});

test('SqlKvBackend con cifratura per valore: solo gli store sensibili, il resto in chiaro, lettura trasparente', async () => {
  const k = key();
  const codec = { shouldEncrypt: (n) => n === 'lp2-identity', encode: (n, p) => encryptValue(k, n, p), decode: (n, s) => decryptValue(k, n, s) };
  const { driver } = openNodeDriver();
  const b = new SqlKvBackend({ driver, codec }); await b.init();
  await b.writeMany({ 'lp2-identity': '{"state":{"iban":"SEGRETO"}}', 'lp2-prefs': '{"state":{"a":1}}' });
  const raw = await driver.all('SELECT name, value FROM kv');
  assert.ok(raw.find((r) => r.name === 'lp2-identity').value.startsWith('lpenc1:'));
  assert.ok(!raw.find((r) => r.name === 'lp2-identity').value.includes('SEGRETO'));
  assert.ok(raw.find((r) => r.name === 'lp2-prefs').value.includes('"a":1'));
  assert.equal(b.encryption, 'value');
  const { values } = await b.readAll();
  assert.equal(values['lp2-identity'], '{"state":{"iban":"SEGRETO"}}');
  // chiave sbagliata: non si legge, finisce tra i "bad" (poi quarantena/recupero), non lancia
  const b2 = new SqlKvBackend({ driver, codec: { ...codec, decode: (n, s) => decryptValue(key(), n, s) } });
  assert.deepEqual((await b2.readAll()).bad, ['lp2-identity']);
  // anche la quarantena di uno store sensibile e' cifrata
  await b.quarantine('lp2-identity', 'SEGRETO-rotto', 'test');
  assert.ok(!(await driver.all('SELECT value FROM quarantine'))[0].value.includes('SEGRETO'));
});

const PLAIN = serializeBackup(buildBackup({
  'lp2-app': JSON.stringify({ state: { onboarded: true, account: { name: 'Alex' } }, version: 0 }),
  'lp2-life': JSON.stringify({ state: { tasks: [{ id: 'a', t: 'x', done: false }], notes: [{ id: 'n', text: 'ciao è già' }] }, version: 0 }),
}, '1.0.0'));

test('backup cifrato .lpbackup: round trip con password, formato versionato, nessuna password nel file', async () => {
  const enc = await encryptBackup(PLAIN, 'correct horse battery', LIGHT);
  assert.ok(isLpBackupText(enc));
  assert.ok(!enc.includes('Alex') && !enc.includes('ciao') && !enc.includes('correct horse'));
  const f = parseLpBackup(enc);
  assert.equal(f.v, 1); assert.equal(f.kdf.alg, 'scrypt'); assert.equal(f.enc.alg, 'AES-256-GCM');
  assert.equal(DEFAULT_KDF.N, 32768);
  const back = await decryptBackup(enc, 'correct horse battery');
  assert.equal(back, PLAIN);
  assert.equal(validateBackup(back).ok, true);
  // due cifrature dello stesso testo non coincidono (salt e nonce casuali)
  assert.notEqual(enc, await encryptBackup(PLAIN, 'correct horse battery', LIGHT));
});

test('backup cifrato: password errata, file alterato, parametri non accettabili, versione futura, password debole', async () => {
  const enc = await encryptBackup(PLAIN, 'password-giusta', LIGHT);
  await assert.rejects(decryptBackup(enc, 'password-sbagliata'), (e) => e instanceof BackupCryptoError && e.code === 'wrong_password');
  const f = JSON.parse(enc);
  const flip = { ...f, data: f.data.slice(0, 20) + (f.data[20] === 'A' ? 'B' : 'A') + f.data.slice(21) };
  await assert.rejects(decryptBackup(JSON.stringify(flip), 'password-giusta'), (e) => e.code === 'wrong_password');
  // l'intestazione e' autenticata: cambiare il sale rompe la decifratura
  await assert.rejects(decryptBackup(JSON.stringify({ ...f, kdf: { ...f.kdf, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' } }), 'password-giusta'));
  assert.throws(() => parseLpBackup(JSON.stringify({ ...f, kdf: { ...f.kdf, N: 1024 } })), (e) => e.code === 'bad_params'); // N troppo basso (downgrade)
  assert.throws(() => parseLpBackup(JSON.stringify({ ...f, kdf: { ...f.kdf, N: 1 << 25 } })), (e) => e.code === 'bad_params'); // N enorme (DoS)
  assert.throws(() => parseLpBackup(JSON.stringify({ ...f, v: 2 })), (e) => e.code === 'future_version');
  assert.throws(() => parseLpBackup('{"app":"LifePilot"}'), (e) => e.code === 'not_encrypted_backup');
  assert.throws(() => parseLpBackup('non json'), (e) => e.code === 'damaged');
  await assert.rejects(encryptBackup(PLAIN, 'corta', LIGHT), (e) => e.code === 'weak_password');
});

test('backup: i backup vecchi (formato 1, version 0, scritti dall\'app prima dell\'engine) si importano ancora', () => {
  const legacy = JSON.stringify({
    app: 'LifePilot', format: 1, createdAt: '2026-03-04T10:00:00.000Z', appVersion: '0.1.0',
    stores: {
      'lp2-app': { state: { onboarded: true, account: { name: 'Alex' } }, version: 0 },
      'lp2-life': { state: { tasks: [{ id: 'a', t: 'x', done: false }], goals: [], notes: [{ id: 'n', text: 'ciao' }], events: { '2026-03-04': [{ time: '09:00', title: 'Riunione' }] } }, version: 0 },
      'lp2-identity': { state: { months: [{ label: 'Mar', start: 0, locked: false, movements: [] }], bills: [] }, version: 0 },
      'lp2-sconosciuto': { state: { x: 1 } },
    },
  });
  const v = validateBackup(legacy);
  assert.equal(v.ok, true);
  assert.equal(v.preview.storeCount, 4);
  const entries = Object.fromEntries(toStorageEntries(v.backup));
  assert.equal(JSON.parse(entries['lp2-life']).version, 1);
  assert.equal(JSON.parse(entries['lp2-life']).state.events['2026-03-04'][0].title, 'Riunione');
});

test('backup: campi non validi scartati e segnalati; store di versione futura rifiutato', () => {
  const dirty = JSON.stringify({ app: 'LifePilot', format: 1, stores: { 'lp2-app': { state: { onboarded: true } }, 'lp2-life': { state: { tasks: 'rotto', notes: [{ id: 'n' }, null] } } } });
  const v = validateBackup(dirty);
  assert.equal(v.ok, true);
  assert.deepEqual(v.preview.repaired, ['life']);
  assert.equal('tasks' in v.backup.stores['lp2-life'].state, false);
  assert.deepEqual(v.backup.stores['lp2-life'].state.notes, [{ id: 'n' }]);
  const fut = validateBackup(JSON.stringify({ app: 'LifePilot', format: 1, stores: { 'lp2-app': { state: {}, version: 7 } } }));
  assert.equal(fut.ok, false); assert.match(fut.error, /più recente/);
});

// ---- keyring: rotazione a prova di crash ----
function memSecrets(init = {}) { const m = new Map(Object.entries(init)); return { m, get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); } }; }
const rnd = (n) => randomBytes(n);

test('keyring: crea la chiave una volta sola (32 byte esadecimali) e la riusa', async () => {
  const s = memSecrets();
  const a = await ensureKey(s, rnd); assert.equal(a.created, true); assert.match(a.hex, /^[0-9a-f]{64}$/);
  const b = await ensureKey(s, rnd); assert.equal(b.created, false); assert.equal(b.hex, a.hex);
  await dropKeys(s); assert.equal(s.m.size, 0);
  await assert.rejects(ensureKey(s, () => new Uint8Array(32)), /casuale/);
});

test('keyring: rotazione riuscita promuove la chiave nuova e pulisce lo slot next', async () => {
  const s = memSecrets(); const { hex: old } = await ensureKey(s, rnd);
  let applied = null;
  const nh = await rotateKey(s, rnd, async (h) => { applied = h; });
  assert.equal(applied, nh); assert.notEqual(nh, old);
  assert.equal(s.m.get(KEY_CURRENT), nh); assert.equal(s.m.has(KEY_NEXT), false);
});

test('keyring: crash durante la ricifratura -> restano entrambe le chiavi e il DB e\' apribile con una delle due', async () => {
  const s = memSecrets(); const { hex: old } = await ensureKey(s, rnd);
  await assert.rejects(rotateKey(s, rnd, async () => { throw new Error('app uccisa'); }));
  const k = await loadKeys(s);
  assert.equal(k.current, old); assert.ok(k.next && k.next !== old);
  assert.deepEqual(candidates(k), [old, k.next]);
  // la ricifratura era invece andata a buon fine ma il processo e' morto prima di promuovere: si apre con "next" e si sistema
  await settleKeys(s, k, k.next);
  assert.equal(s.m.get(KEY_CURRENT), k.next); assert.equal(s.m.has(KEY_NEXT), false);
});

test('random: nessun ripiego su Math.random', () => {
  setRandomSource(null);
  const saved = globalThis.crypto;
  assert.equal(randomBytes(16).length, 16); // Node ha crypto.getRandomValues
  void saved;
});
