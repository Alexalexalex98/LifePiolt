import { bytesToHex } from './base64.ts';

/**
 * Gestione della chiave di cifratura a riposo (32 byte casuali) custodita nel Keychain/Keystore.
 * Logica pura: l'archivio dei segreti e la fonte casuale sono iniettati.
 * Rotazione a prova di crash: scrivo PRIMA la chiave nuova (slot "next"), poi ricifro il database, poi la promuovo.
 * All'apertura provo prima "current", poi "next": qualunque punto di interruzione resta apribile.
 */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export const KEY_CURRENT = 'lp.dbkey.v1';
export const KEY_NEXT = 'lp.dbkey.next';

export type KeyCandidates = { current: string | null; next: string | null };

export async function loadKeys(store: SecretStore): Promise<KeyCandidates> {
  return { current: await store.get(KEY_CURRENT), next: await store.get(KEY_NEXT) };
}

export const isValidKeyHex = (h: string | null | undefined): h is string => !!h && /^[0-9a-f]{64}$/.test(h);

export function newKeyHex(rand: (n: number) => Uint8Array): string {
  const b = rand(32);
  if (b.length !== 32 || b.every((x) => x === 0)) throw new Error('fonte casuale non valida');
  return bytesToHex(b);
}

/** Restituisce la chiave corrente, creandola se manca. */
export async function ensureKey(store: SecretStore, rand: (n: number) => Uint8Array): Promise<{ hex: string; created: boolean }> {
  const cur = await store.get(KEY_CURRENT);
  if (isValidKeyHex(cur)) return { hex: cur, created: false };
  const hex = newKeyHex(rand);
  await store.set(KEY_CURRENT, hex);
  // rilettura: se il Keychain non ha davvero salvato non vado avanti cifrando con una chiave persa
  if ((await store.get(KEY_CURRENT)) !== hex) throw new Error('Il Keychain non conserva la chiave.');
  return { hex, created: true };
}

/** Ordine di tentativi per aprire il database. */
export function candidates(k: KeyCandidates): string[] {
  const out: string[] = [];
  if (isValidKeyHex(k.current)) out.push(k.current);
  if (isValidKeyHex(k.next) && k.next !== k.current) out.push(k.next);
  return out;
}

/** Dopo un'apertura riuscita con la chiave `usedHex`, rende coerenti gli slot (promuove/pulisce "next"). */
export async function settleKeys(store: SecretStore, k: KeyCandidates, usedHex: string): Promise<void> {
  if (usedHex === k.next && k.current !== usedHex) await store.set(KEY_CURRENT, usedHex);
  if (k.next) await store.del(KEY_NEXT);
}

/** Cambia la chiave: `rekey(newHex)` ricifra il database (PRAGMA rekey). */
export async function rotateKey(store: SecretStore, rand: (n: number) => Uint8Array, rekey: (newHex: string) => Promise<void>): Promise<string> {
  const hex = newKeyHex(rand);
  await store.set(KEY_NEXT, hex);
  if ((await store.get(KEY_NEXT)) !== hex) throw new Error('Il Keychain non conserva la nuova chiave.');
  await rekey(hex);
  await store.set(KEY_CURRENT, hex);
  await store.del(KEY_NEXT);
  return hex;
}

export async function dropKeys(store: SecretStore): Promise<void> {
  await store.del(KEY_NEXT).catch(() => undefined);
  await store.del(KEY_CURRENT);
}
