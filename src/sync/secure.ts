/**
 * Dati sensibili o per-dispositivo della sincronizzazione, fuori da AsyncStorage (e quindi fuori dal backup):
 *  - id del dispositivo (non deve mai finire su un altro telefono tramite un backup);
 *  - indirizzo del server e chiave pubblica (anon key). La anon key non e' un segreto, ma sta comunque nel portachiavi.
 * Su web expo-secure-store non esiste: ripiego su localStorage. Ogni accesso e' difensivo.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { uuidv7 } from './ids.ts';

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return await SecureStore.getItemAsync(key);
  } catch { return null; }
}
async function setItem(key: string, value: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); return true; }
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch { return false; }
}
async function delItem(key: string) {
  try {
    if (Platform.OS === 'web') { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); return; }
    await SecureStore.deleteItemAsync(key);
  } catch { /* ignore */ }
}

const DEVICE_KEY = 'lpsync_device_id';
const SERVER_KEY = 'lpsync_server';

export async function loadDeviceId(): Promise<string> {
  const cur = await getItem(DEVICE_KEY);
  if (cur) return cur;
  const id = uuidv7();
  await setItem(DEVICE_KEY, id);
  return id;
}

export type ServerConfig = { url: string; anonKey: string };
export async function loadServerConfig(): Promise<ServerConfig> {
  const raw = await getItem(SERVER_KEY);
  try { const p = raw ? (JSON.parse(raw) as Partial<ServerConfig>) : {}; return { url: p.url ?? '', anonKey: p.anonKey ?? '' }; } catch { return { url: '', anonKey: '' }; }
}
export async function saveServerConfig(c: ServerConfig): Promise<boolean> {
  if (!c.url && !c.anonKey) { await delItem(SERVER_KEY); return true; }
  return setItem(SERVER_KEY, JSON.stringify(c));
}
