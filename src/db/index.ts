import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, InteractionManager, Platform } from 'react-native';

import { destroyStorage, openBackend } from './backend';
import { KvEngine } from './engine.ts';
import { pushNotice, setStorageInfo } from './status.ts';
import type { KvBackend, Notify } from './types.ts';

/**
 * Punto unico di accesso all'engine di persistenza (singleton). Il backend si apre alla prima lettura
 * (SQLite sul telefono, localStorage sul web) e la migrazione da AsyncStorage avviene prima di leggere qualsiasi store.
 */
const notify: Notify = (n) => pushNotice(n);

/** Backend "differito": si apre alla prima init(), cosi' l'engine si crea in modo sincrono. */
class DeferredBackend implements KvBackend {
  private inner: KvBackend | null = null;
  private before: ((b: KvBackend) => Promise<void>) | undefined;
  private opening: Promise<KvBackend> | null = null;
  get kind() { return this.inner?.kind ?? 'memory'; }
  get encryption() { return this.inner?.encryption ?? 'none'; }
  private open() {
    if (!this.opening) this.opening = openBackend(notify).then((o) => { this.inner = o.backend; this.before = o.beforeFirstRead; return o.backend; });
    return this.opening;
  }
  get real(): KvBackend | null { return this.inner; }
  async init() { const b = await this.open(); await b.init(); }
  async runBeforeFirstRead() { if (this.before && this.inner) await this.before(this.inner); }
  private get b() { if (!this.inner) throw new Error('archivio non aperto'); return this.inner; }
  isSharded(n: string) { return this.inner?.isSharded?.(n) ?? false; }
  writeStores(items: { name: string; state: Record<string, unknown>; version: number }[], opts?: { verify?: boolean }) { return this.b.writeStores ? this.b.writeStores(items, opts) : Promise.resolve({ pieces: 0, serialized: 0 }); }
  noteHydrated(n: string, state: Record<string, unknown>) { this.inner?.noteHydrated?.(n, state); }
  readAll() { return this.b.readAll(); }
  readBackup(n: string) { return this.b.readBackup(n); }
  writeMany(e: Record<string, string>, v?: Record<string, number>) { return this.b.writeMany(e, v); }
  remove(n: string[]) { return this.b.remove(n); }
  clear() { return this.b.clear(); }
  quarantine(n: string, r: string, why: string) { return this.b.quarantine(n, r, why); }
  sizes() { return this.b.sizes(); }
  maintain(f?: boolean) { return this.b.maintain(f); }
  close() { return this.inner ? this.inner.close() : Promise.resolve(); }
}

let engine: KvEngine | null = null;
let deferred: DeferredBackend | null = null;
let hooked = false;

function hookLifecycle() {
  if (hooked) return;
  hooked = true;
  // scrivo subito quando l'app esce dal primo piano: e' il momento in cui il sistema puo' terminarla
  try { AppState.addEventListener('change', (s) => { if (s !== 'active') void engine?.flush({ full: true }); }); } catch { /* ignore */ }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const f = () => { void engine?.flush({ full: true }); };
    window.addEventListener('pagehide', f);
    window.addEventListener('beforeunload', f);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') f(); });
  }
}

export function getEngine(): KvEngine {
  if (!engine) {
    const d = new DeferredBackend();
    deferred = d;
    engine = new KvEngine({
      backend: d,
      beforeFirstRead: () => d.runBeforeFirstRead(),
      notify,
      debounceMs: Platform.OS === 'web' ? 100 : 500,
      maxWaitMs: 3000,
      runIdle: Platform.OS === 'web' ? undefined : (fn) => { InteractionManager.runAfterInteractions(fn); },
    });
    hookLifecycle();
  }
  return engine;
}

/** Backend reale (dopo l'apertura), per manutenzione, ricerca e schermata Sicurezza. */
export const realBackend = (): KvBackend | null => deferred?.real ?? null;

export async function flushNow() { await engine?.flush(); }

/** Tutti i dati salvati: nome (lp2-xxx) -> JSON. Include le modifiche non ancora scritte. */
export async function snapshotAll(): Promise<Record<string, string>> { return getEngine().snapshot(); }

/** "Elimina tutti i dati": svuota l'archivio, elimina i file del database e la chiave di cifratura, rimuove la vecchia copia. */
export async function wipeStorage(): Promise<void> {
  const e = getEngine();
  await e.clearAll();
  try { await destroyStorage(); } catch { /* ignore */ }
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('lp2-'));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch { /* ignore */ }
  engine = null; deferred = null;
  setStorageInfo({ mode: 'opening', dbName: '' });
}

export { pushNotice };
