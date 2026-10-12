import * as SecureStore from 'expo-secure-store';

import type { SecretStore } from './keyring.ts';

const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/** Keychain (iOS) / Keystore (Android). Sul web non esiste: availability() lo dice e la cifratura per chiave non si usa. */
export const secretStore: SecretStore = {
  get: (k) => SecureStore.getItemAsync(k, OPTS),
  set: (k, v) => SecureStore.setItemAsync(k, v, OPTS),
  del: (k) => SecureStore.deleteItemAsync(k, OPTS),
};

export async function secretStoreAvailable(): Promise<boolean> {
  try { return await SecureStore.isAvailableAsync(); } catch { return false; }
}
