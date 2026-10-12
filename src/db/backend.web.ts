import AsyncStorage from '@react-native-async-storage/async-storage';

import { AsyncKvBackend } from './asyncKv.ts';
import { setStorageInfo } from './status.ts';
import type { KvBackend, Notify } from './types.ts';

/**
 * Web: expo-sqlite sul web richiede WebAssembly + SharedArrayBuffer (intestazioni COOP/COEP che l'hosting statico non da'
 * e che romperebbero iframe e risorse esterne): qui uso localStorage tramite AsyncStorage, con lo stesso formato `lp2-*`.
 */
export type OpenedBackend = { backend: KvBackend; beforeFirstRead?: (b: KvBackend) => Promise<void> };

export async function openBackend(_notify: Notify): Promise<OpenedBackend> {
  setStorageInfo({ mode: 'asyncstorage', encryption: 'none', encryptionNote: 'Sul web i dati restano nel browser, non cifrati.', dbName: 'localStorage' });
  return { backend: new AsyncKvBackend(AsyncStorage) };
}

export async function rotateDbKey(): Promise<boolean> { return false; }
export async function destroyStorage(): Promise<void> { /* niente file */ }
export function databaseFiles(): { name: string; bytes: number }[] { return []; }
export function deleteDatabaseFile(_name: string) { /* niente */ }
