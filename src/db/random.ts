import { getRandomBytes } from 'expo-crypto';

import { setRandomSource } from './crypto.ts';

/** Collega la fonte casuale sicura di expo-crypto (Keystore/SecRandom; sul web crypto.getRandomValues). */
let done = false;
export function initRandom() {
  if (done) return;
  setRandomSource((n) => getRandomBytes(n));
  done = true;
}
export const secureRandom = (n: number): Uint8Array => { initRandom(); return getRandomBytes(n); };
