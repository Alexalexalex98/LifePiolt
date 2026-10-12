import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File } from 'expo-file-system';

import { AsyncKvBackend } from './asyncKv.ts';
import { hexToBytes } from './base64.ts';
import { decryptValue, encryptValue } from './crypto.ts';
import { copyKvTables } from './dbCopy.ts';
import { candidates, ensureKey, loadKeys, rotateKey, settleKeys, dropKeys } from './keyring.ts';
import { runLegacyMigration } from './legacyMigration.ts';
import { isSensitive } from './migrations.ts';
import { initRandom, secureRandom } from './random.ts';
import { secretStore, secretStoreAvailable } from './secretStore.ts';
import { SqlKvBackend, type ValueCodec } from './sqlKv.ts';
import { databaseDirectory, deleteDatabase, openNativeDriver, rekeyDriver } from './sqliteDriver.ts';
import { setStorageInfo } from './status.ts';
import type { KvBackend, Notify, SqlDriver } from './types.ts';

/**
 * Apertura del backend sul telefono. Ordine di preferenza:
 *   1. SQLite + SQLCipher (build di sviluppo/produzione con il plugin useSQLCipher): tutto il database e' cifrato, chiave nel Keychain.
 *   2. SQLite normale (Expo Go): cifratura per valore (AES-256-GCM) degli store sensibili, chiave nel Keychain.
 *   3. AsyncStorage (se SQLite non si apre affatto): stesso formato di prima. L'app non si rompe mai.
 */
export const DB_PLAIN = 'lifepilot.db';
export const DB_ENC = 'lifepilot-enc.db';

export type OpenedBackend = { backend: KvBackend; beforeFirstRead?: (b: KvBackend) => Promise<void> };

let current: { driver: SqlDriver; name: string; cipher: boolean } | null = null;

const dirUri = () => { const d = databaseDirectory(); return d.startsWith('file://') ? d : 'file://' + d; };

function moveAside(name: string) {
  const dir = new Directory(dirUri());
  const ts = Date.now();
  for (const suf of ['', '-wal', '-shm']) {
    try {
      const f = new File(dir, name + suf);
      if (f.exists) f.move(new File(dir, `${name}.corrupt-${ts}${suf}`));
    } catch { /* ignore */ }
  }
}
const dbExists = (name: string) => { try { return new File(new Directory(dirUri()), name).exists; } catch { return false; } };

async function readableSchema(d: SqlDriver) { await d.all('SELECT count(*) FROM sqlite_master'); }

export async function openSqliteBackend(notify: Notify): Promise<OpenedBackend> {
  initRandom();
  // 1) il motore ha SQLCipher?
  let cipherVersion: string | null = null;
  try {
    const probe = await openNativeDriver(':memory:', null);
    cipherVersion = probe.cipherVersion;
    await probe.driver.close();
  } catch { /* se nemmeno :memory: si apre, lascio fallire piu' sotto */ }

  const keyOk = await secretStoreAvailable();
  const base = { legacy: '' };

  if (cipherVersion && keyOk) {
    const keys = await loadKeys(secretStore);
    const { hex } = await ensureKey(secretStore, secureRandom);
    const tryOrder = [hex, ...candidates(keys).filter((k) => k !== hex)];
    let opened: { driver: SqlDriver; hex: string } | null = null;
    for (const k of tryOrder) {
      try {
        const o = await openNativeDriver(DB_ENC, k);
        await readableSchema(o.driver);
        opened = { driver: o.driver, hex: k };
        break;
      } catch { /* chiave sbagliata o file non leggibile: provo la successiva */ }
    }
    if (!opened) {
      if (dbExists(DB_ENC)) {
        moveAside(DB_ENC);
        notify({ kind: 'db_corrupt_reset', level: 'error', message: 'L\'archivio cifrato non è leggibile su questo dispositivo (chiave non corrispondente o file danneggiato). L\'ho messo da parte e riparto da zero: ripristina da un backup o dalla copia precedente se disponibile.' });
      }
      const o = await openNativeDriver(DB_ENC, hex);
      opened = { driver: o.driver, hex };
    }
    await settleKeys(secretStore, keys, opened.hex);
    const backend = new SqlKvBackend({ driver: opened.driver, sqlcipher: true });
    try { await backend.init(); } catch {
      await opened.driver.close().catch(() => undefined);
      moveAside(DB_ENC);
      notify({ kind: 'db_corrupt_reset', level: 'error', message: 'L\'archivio dei dati era danneggiato: l\'ho messo da parte e riparto da zero. Ripristina da un backup se ne hai uno.' });
      const o = await openNativeDriver(DB_ENC, opened.hex);
      current = { driver: o.driver, name: DB_ENC, cipher: true };
      const b2 = new SqlKvBackend({ driver: o.driver, sqlcipher: true });
      await b2.init();
      setStorageInfo({ mode: 'sqlite', encryption: 'sqlcipher', cipherVersion, encryptionNote: '', dbName: DB_ENC, ...base });
      return { backend: b2, beforeFirstRead: legacyStep(notify, b2) };
    }
    current = { driver: opened.driver, name: DB_ENC, cipher: true };
    // un eventuale database non cifrato creato in precedenza viene travasato e poi eliminato (solo dopo la verifica)
    if (dbExists(DB_PLAIN)) {
      try {
        const old = await openNativeDriver(DB_PLAIN, null);
        const oldBackend = new SqlKvBackend({ driver: old.driver });
        await oldBackend.init();
        await copyKvTables(old.driver, opened.driver);
        await old.driver.close();
        await deleteDatabase(DB_PLAIN);
      } catch { /* resta dov'e': riprovo al prossimo avvio */ }
    }
    setStorageInfo({ mode: 'sqlite', encryption: 'sqlcipher', cipherVersion, encryptionNote: '', dbName: DB_ENC, ...base });
    return { backend, beforeFirstRead: legacyStep(notify, backend) };
  }

  // senza SQLCipher: SQLite normale, con cifratura per valore se il Keychain c'e'
  const o = await openNativeDriver(DB_PLAIN, null);
  let codec: ValueCodec | null = null;
  let note = '';
  if (keyOk) {
    try {
      const { hex } = await ensureKey(secretStore, secureRandom);
      const key = hexToBytes(hex);
      codec = { shouldEncrypt: isSensitive, encode: (n, p) => encryptValue(key, n, p), decode: (n, s) => decryptValue(key, n, s) };
      note = 'Cifratura per sezione attiva (finanze, salute, identità, chat, condivisione, piano). La cifratura completa del database richiede l\'app installata (build), non Expo Go.';
      notify({ kind: 'no_encryption', level: 'info', message: 'La cifratura completa richiede l\'app installata (build): in Expo Go proteggo solo le sezioni sensibili.' });
    } catch {
      note = 'Il Keychain non è disponibile: i dati non sono cifrati.';
      notify({ kind: 'key_unavailable', level: 'warn', message: 'Il Keychain del telefono non è disponibile: i dati restano non cifrati.' });
    }
  } else {
    note = 'Il Keychain non è disponibile: i dati non sono cifrati.';
  }
  const backend = new SqlKvBackend({ driver: o.driver, codec });
  try { await backend.init(); } catch {
    await o.driver.close().catch(() => undefined);
    moveAside(DB_PLAIN);
    notify({ kind: 'db_corrupt_reset', level: 'error', message: 'L\'archivio dei dati era danneggiato: l\'ho messo da parte e riparto da zero. Ripristina da un backup se ne hai uno.' });
    const o2 = await openNativeDriver(DB_PLAIN, null);
    const b2 = new SqlKvBackend({ driver: o2.driver, codec });
    await b2.init();
    current = { driver: o2.driver, name: DB_PLAIN, cipher: false };
    setStorageInfo({ mode: 'sqlite', encryption: codec ? 'value' : 'none', cipherVersion: null, encryptionNote: note, dbName: DB_PLAIN, ...base });
    return { backend: b2, beforeFirstRead: legacyStep(notify, b2) };
  }
  current = { driver: o.driver, name: DB_PLAIN, cipher: false };
  setStorageInfo({ mode: 'sqlite', encryption: codec ? 'value' : 'none', cipherVersion: null, encryptionNote: note, dbName: DB_PLAIN, ...base });
  return { backend, beforeFirstRead: legacyStep(notify, backend) };
}

function legacyStep(notify: Notify, _b: SqlKvBackend) {
  return async (b: KvBackend) => {
    const r = await runLegacyMigration({ source: AsyncStorage, backend: b as SqlKvBackend, notify });
    setStorageInfo({ legacy: r.action });
  };
}

/** Apre il backend piu' adatto; se SQLite non parte affatto ripiega su AsyncStorage senza rompere l'app. */
export async function openBackend(notify: Notify): Promise<OpenedBackend> {
  try {
    return await openSqliteBackend(notify);
  } catch (e) {
    setStorageInfo({ mode: 'asyncstorage', encryption: 'none', encryptionNote: 'SQLite non disponibile: uso l\'archivio semplice del telefono.', dbName: '' });
    notify({ kind: 'no_encryption', level: 'warn', message: 'L\'archivio avanzato non è disponibile: uso quello semplice. I dati restano salvati ma non cifrati.' });
    void e;
    return { backend: new AsyncKvBackend(AsyncStorage) };
  }
}

/** Cambia la chiave di cifratura del database (solo SQLCipher). Ritorna false se non applicabile. */
export async function rotateDbKey(): Promise<boolean> {
  if (!current?.cipher) return false;
  await rotateKey(secretStore, secureRandom, (hex) => rekeyDriver(current!.driver, hex));
  return true;
}

/** Elimina fisicamente database e chiave (Elimina tutti i dati). */
export async function destroyStorage(): Promise<void> {
  const names = [DB_ENC, DB_PLAIN];
  try { await current?.driver.close(); } catch { /* ignore */ }
  current = null;
  for (const n of names) { try { await deleteDatabase(n); } catch { /* non esisteva */ } }
  try { await dropKeys(secretStore); } catch { /* ignore */ }
  try {
    const dir = new Directory(dirUri());
    for (const item of dir.list()) { if (/\.corrupt-/.test(item.name)) { try { item.delete(); } catch { /* ignore */ } } }
  } catch { /* ignore */ }
}

/** File di database e relative dimensioni (per Spazio occupato). */
export function databaseFiles(): { name: string; bytes: number }[] {
  const out: { name: string; bytes: number }[] = [];
  try {
    for (const item of new Directory(dirUri()).list()) { if (item instanceof File) out.push({ name: item.name, bytes: item.size ?? 0 }); }
  } catch { /* ignore */ }
  return out;
}
export function deleteDatabaseFile(name: string) { try { new File(new Directory(dirUri()), name).delete(); } catch { /* ignore */ } }
