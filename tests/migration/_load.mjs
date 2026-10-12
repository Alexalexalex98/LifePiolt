// Helper dei test di migrazione: carica le fixture congelate e costruisce un AsyncStorage finto.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const loadStateV0 = () => JSON.parse(readFileSync(join(root, 'state-v0.json'), 'utf8')).storage;
export const loadBackupV1Text = () => readFileSync(join(root, 'backup-v1.json'), 'utf8');
export const clone = (v) => JSON.parse(JSON.stringify(v));

export function fakeAsyncStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getAllKeys: async () => [...m.keys()],
    multiGet: async (ks) => ks.map((k) => [k, m.has(k) ? m.get(k) : null]),
    multiSet: async (es) => { for (const [k, v] of es) m.set(k, v); },
    multiRemove: async (ks) => { for (const k of ks) m.delete(k); },
  };
}
