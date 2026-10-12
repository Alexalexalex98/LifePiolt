/**
 * Cifratura: solo primitive verificate di @noble (AES-256-GCM, scrypt), nessuna crittografia fatta in casa.
 * Modulo puro: la fonte casuale viene iniettata (expo-crypto sul telefono, crypto.getRandomValues sul web/Node).
 */
import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';

import { base64ToBytes, bytesToBase64, fromUtf8, utf8 } from './base64.ts';

let rng: ((n: number) => Uint8Array) | null = null;
/** Imposta la fonte di casualita' sicura (obbligatoria sul telefono: Hermes non ha crypto.getRandomValues). */
export function setRandomSource(fn: (n: number) => Uint8Array) { rng = fn; }

export function randomBytes(n: number): Uint8Array {
  if (rng) return rng(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint8Array(n));
  throw new Error('Nessuna fonte casuale sicura disponibile su questo dispositivo.');
}

const NONCE = 12;

/** AES-256-GCM: ritorna nonce(12) | testo cifrato | tag(16). */
export function aesEncrypt(key: Uint8Array, plain: Uint8Array, aad?: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('chiave non valida');
  const nonce = randomBytes(NONCE);
  const ct = gcm(key, nonce, aad).encrypt(plain);
  const out = new Uint8Array(NONCE + ct.length);
  out.set(nonce, 0); out.set(ct, NONCE);
  return out;
}

export function aesDecrypt(key: Uint8Array, blob: Uint8Array, aad?: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('chiave non valida');
  if (blob.length < NONCE + 16) throw new Error('dati cifrati troncati');
  return gcm(key, blob.subarray(0, NONCE), aad).decrypt(blob.subarray(NONCE));
}

// ---- cifratura per valore (store sensibili, quando SQLCipher non c'e') ----

export const VALUE_PREFIX = 'lpenc1:';
export const isEncryptedValue = (s: string) => s.startsWith(VALUE_PREFIX);

export function encryptValue(key: Uint8Array, name: string, text: string): string {
  return VALUE_PREFIX + bytesToBase64(aesEncrypt(key, utf8(text), utf8('lp-kv|' + name)));
}

export function decryptValue(key: Uint8Array, name: string, stored: string): string {
  if (!isEncryptedValue(stored)) return stored;
  return fromUtf8(aesDecrypt(key, base64ToBytes(stored.slice(VALUE_PREFIX.length)), utf8('lp-kv|' + name)));
}

// ---- backup cifrato con password (.lpbackup) ----

export const LPBACKUP_MAGIC = 'LPBACKUP';
export const LPBACKUP_VERSION = 1;
/** scrypt N=2^15, r=8, p=1: ~32 MB di memoria. Valori scritti nel file, quindi alzabili in futuro senza rompere i vecchi backup. */
export const DEFAULT_KDF = { alg: 'scrypt' as const, N: 32768, r: 8, p: 1 };
const KDF_MIN_N = 1 << 14, KDF_MAX_N = 1 << 20;
export const MIN_PASSWORD = 8;

export type LpBackupFile = {
  magic: typeof LPBACKUP_MAGIC; v: number;
  kdf: { alg: 'scrypt'; N: number; r: number; p: number; salt: string };
  enc: { alg: 'AES-256-GCM'; nonce: string };
  data: string;
};

const headerAad = (kdf: LpBackupFile['kdf'], v: number) => utf8(`${LPBACKUP_MAGIC}|${v}|${kdf.alg}|${kdf.N}|${kdf.r}|${kdf.p}|${kdf.salt}`);
const normalizePassword = (p: string) => utf8(p.normalize('NFKC'));

async function deriveKey(password: string, kdf: LpBackupFile['kdf'], onProgress?: (p: number) => void): Promise<Uint8Array> {
  return scryptAsync(normalizePassword(password), base64ToBytes(kdf.salt), { N: kdf.N, r: kdf.r, p: kdf.p, dkLen: 32, onProgress });
}

export class BackupCryptoError extends Error {
  code: 'weak_password' | 'wrong_password' | 'not_encrypted_backup' | 'future_version' | 'bad_params' | 'damaged';
  constructor(code: BackupCryptoError['code'], message: string) { super(message); this.code = code; }
}

export function isLpBackupText(text: string): boolean {
  const head = text.slice(0, 200);
  return head.includes('"magic"') && head.includes(LPBACKUP_MAGIC);
}

/** Cifra il testo del backup. La password non viene mai salvata. `params` solo per i test (parametri leggeri). */
export async function encryptBackup(plainJson: string, password: string, params: Partial<typeof DEFAULT_KDF> = {}, onProgress?: (p: number) => void): Promise<string> {
  if (password.length < MIN_PASSWORD) throw new BackupCryptoError('weak_password', `La password deve avere almeno ${MIN_PASSWORD} caratteri.`);
  const kdf = { ...DEFAULT_KDF, ...params, salt: bytesToBase64(randomBytes(16)) };
  const key = await deriveKey(password, kdf, onProgress);
  const blob = aesEncrypt(key, utf8(plainJson), headerAad(kdf, LPBACKUP_VERSION));
  key.fill(0);
  const file: LpBackupFile = { magic: LPBACKUP_MAGIC, v: LPBACKUP_VERSION, kdf, enc: { alg: 'AES-256-GCM', nonce: bytesToBase64(blob.subarray(0, NONCE)) }, data: bytesToBase64(blob.subarray(NONCE)) };
  return JSON.stringify(file);
}

export function parseLpBackup(text: string): LpBackupFile {
  let f: unknown;
  try { f = JSON.parse(text); } catch { throw new BackupCryptoError('damaged', 'Il file non è leggibile.'); }
  const o = f as Partial<LpBackupFile> | null;
  if (!o || typeof o !== 'object' || o.magic !== LPBACKUP_MAGIC) throw new BackupCryptoError('not_encrypted_backup', 'Questo file non è un backup cifrato di LifePilot.');
  if (typeof o.v !== 'number' || !Number.isInteger(o.v) || o.v < 1) throw new BackupCryptoError('damaged', 'Il backup cifrato non ha una versione riconoscibile.');
  if (o.v > LPBACKUP_VERSION) throw new BackupCryptoError('future_version', 'Il backup viene da una versione più recente di LifePilot: aggiorna l\'app e riprova.');
  const k = o.kdf, e = o.enc;
  if (!k || k.alg !== 'scrypt' || typeof k.N !== 'number' || typeof k.r !== 'number' || typeof k.p !== 'number' || typeof k.salt !== 'string' || !e || e.alg !== 'AES-256-GCM' || typeof e.nonce !== 'string' || typeof o.data !== 'string') throw new BackupCryptoError('damaged', 'Il backup cifrato è danneggiato.');
  if ((k.N & (k.N - 1)) !== 0 || k.N < KDF_MIN_N || k.N > KDF_MAX_N || k.r < 1 || k.r > 16 || k.p < 1 || k.p > 4) throw new BackupCryptoError('bad_params', 'I parametri di cifratura del backup non sono accettabili.');
  return o as LpBackupFile;
}

/** Decifra un .lpbackup. Password errata o file alterato -> BackupCryptoError('wrong_password'). */
export async function decryptBackup(text: string, password: string, onProgress?: (p: number) => void): Promise<string> {
  const f = parseLpBackup(text);
  let blob: Uint8Array;
  try { const nonce = base64ToBytes(f.enc.nonce); const ct = base64ToBytes(f.data); blob = new Uint8Array(nonce.length + ct.length); blob.set(nonce, 0); blob.set(ct, nonce.length); } catch { throw new BackupCryptoError('damaged', 'Il backup cifrato è danneggiato.'); }
  const key = await deriveKey(password, f.kdf, onProgress);
  try {
    return fromUtf8(aesDecrypt(key, blob, headerAad(f.kdf, f.v)));
  } catch {
    throw new BackupCryptoError('wrong_password', 'Password errata oppure file alterato.');
  } finally { key.fill(0); }
}
