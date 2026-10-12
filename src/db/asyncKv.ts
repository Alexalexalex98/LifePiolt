import type { KvBackend } from './types.ts';

export interface AsyncStorageLike {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(entries: [string, string][]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

export const KV_PREFIX = 'lp2-';
const QUARANTINE_PREFIX = 'lpq-';

/**
 * Backend su AsyncStorage / localStorage: web, e fallback se SQLite non e' disponibile.
 * Stesso formato di sempre (chiave `lp2-<store>` = JSON per intero), quindi retrocompatibile al 100%.
 */
export class AsyncKvBackend implements KvBackend {
  readonly kind = 'asyncstorage' as const;
  readonly encryption = 'none' as const;
  private s: AsyncStorageLike;
  constructor(storage: AsyncStorageLike) { this.s = storage; }

  async init() { /* niente da preparare */ }

  async readAll() {
    const keys = (await this.s.getAllKeys()).filter((k) => k.startsWith(KV_PREFIX));
    const pairs = keys.length ? await this.s.multiGet(keys) : [];
    const values: Record<string, string> = {};
    for (const [k, v] of pairs) if (typeof v === 'string') values[k] = v;
    return { values, bad: [] as string[] };
  }

  async readBackup() { return null; }

  async writeMany(entries: Record<string, string>) {
    const list = Object.entries(entries);
    if (list.length) await this.s.multiSet(list);
  }

  async remove(names: string[]) { if (names.length) await this.s.multiRemove(names); }

  async clear() {
    const keys = (await this.s.getAllKeys()).filter((k) => k.startsWith(KV_PREFIX) || k.startsWith(QUARANTINE_PREFIX));
    if (keys.length) await this.s.multiRemove(keys);
  }

  async quarantine(name: string, raw: string) {
    // sul web lo spazio e' poco: tengo solo l'ultimo blob scartato per store, troncato
    try { await this.s.multiSet([[QUARANTINE_PREFIX + name, raw.slice(0, 200_000)]]); } catch { /* spazio finito */ }
  }

  async sizes() {
    const { values } = await this.readAll();
    return Object.entries(values).map(([name, v]) => ({ name, bytes: v.length, updatedAt: 0 })).sort((a, b) => b.bytes - a.bytes);
  }

  async maintain() { return { vacuumed: false }; }
  async close() { /* niente */ }
}
