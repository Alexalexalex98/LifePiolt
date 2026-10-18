/**
 * Collegamento del motore di sincronizzazione agli store reali dell'app. E' l'unico file di src/sync che importa gli store.
 * Non modifica il codice degli store: li osserva con subscribe/getState e scrive con setState parziale (adattatori inversi).
 * Il motore si avvia SOLO dopo l'idratazione di tutti gli store e in modo non bloccante (mai prima del primo disegno).
 */
import { AppState, Platform } from 'react-native';

import { isOnline } from '@/lib/offline';
import { useChat } from '@/store/chat';
import { useClub } from '@/store/club';
import { useHealth } from '@/store/health';
import { useInterests } from '@/store/interests';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { syncStateAccess, useSync, useSyncData, useSyncStatus } from '@/store/sync';
import { useTravel } from '@/store/travel';

import { devServer } from './devMock';
import { SyncEngine, type StoreLike } from './engine';
import { MockServerTransport } from './mockServer';
import { COLLECTIONS } from './registry';
import { loadDeviceId, loadServerConfig } from './secure';
import { getSupabase } from './supabaseClient';
import { SupabaseTransport } from './supabaseTransport.ts';
import { createTransport, DisconnectedTransport, registerTransport, type SyncTransport } from './transport';
import { identityCodec, type PayloadCodec } from './codec';

type Hook = {
  getState: () => unknown;
  setState: (p: never) => void;
  subscribe: (l: (s: never, p: never) => void) => () => void;
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
};
const HOOKS: Record<string, Hook> = {
  life: useLife as unknown as Hook, health: useHealth as unknown as Hook, travel: useTravel as unknown as Hook, interests: useInterests as unknown as Hook,
  network: useNet as unknown as Hook, chat: useChat as unknown as Hook, club: useClub as unknown as Hook,
};

const asStore = (h: Hook): StoreLike => ({
  getState: () => h.getState(),
  setState: (p) => h.setState(p as never),
  subscribe: (l) => h.subscribe(l as never),
  isReady: () => h.persist.hasHydrated(),
});

let engine: SyncEngine | null = null;
let transport: SyncTransport = new DisconnectedTransport();
let codec: PayloadCodec = identityCodec;
let starting: Promise<SyncEngine> | null = null;

registerTransport('mock-server', (cfg) => new MockServerTransport(devServer, cfg));
registerTransport('supabase', (cfg) => new SupabaseTransport(getSupabase(cfg.url ?? '', cfg.anonKey ?? ''), cfg, Platform.OS));

/** Imposta il codec di cifratura end-to-end (quando esistera'). Con 'identity' le categorie che richiedono E2E restano ferme. */
export function setPayloadCodec(c: PayloadCodec) { codec = c; engine?.reconfigure(); }
export function getTransport(): SyncTransport { return transport; }
export function getEngine(): SyncEngine | null { return engine; }

function whenHydrated(): Promise<void> {
  const all = Object.values(HOOKS);
  if (all.every((h) => h.persist.hasHydrated()) && useSync.persist.hasHydrated() && useSyncData.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const hooks = [...all, useSync as unknown as Hook, useSyncData as unknown as Hook];
    const check = () => { if (hooks.every((h) => h.persist.hasHydrated())) resolve(); };
    hooks.forEach((h) => h.persist.onFinishHydration(check));
    check();
  });
}

/** Crea (una volta) il motore e lo avvia. Non blocca: restituisce una promessa che nessuno e' obbligato ad attendere. */
export function ensureEngine(): Promise<SyncEngine> {
  if (engine) return Promise.resolve(engine);
  if (starting) return starting;
  starting = (async () => {
    await whenHydrated();
    const id = await loadDeviceId();
    if (useSyncData.getState().deviceId !== id) useSyncData.setState({ deviceId: id });
    if (!useSync.getState().deviceName) useSync.setState({ deviceName: 'Questo telefono' });
    const stores: Record<string, StoreLike> = {};
    for (const k of Object.keys(HOOKS)) stores[k] = asStore(HOOKS[k]);
    const e = new SyncEngine({
      bindings: stores, collections: COLLECTIONS, state: syncStateAccess,
      getTransport: () => transport, getCodec: () => codec,
      isOnline: () => { try { return isOnline(); } catch { return true; } },
    });
    e.subscribe((s) => useSyncStatus.setState(s, true));
    engine = e;
    await applyTransport();
    e.start();
    AppState.addEventListener('change', (st) => { if (st === 'active' && engine) { engine.notifyOnline(); } });
    return e;
  })().finally(() => { starting = null; });
  return starting;
}

/** Avvio all'apertura dell'app: parte solo se l'utente ha abilitato qualcosa, dopo un breve ritardo e senza bloccare la navigazione. */
export function startSync() {
  const any = Object.values(useSync.getState().enabled).some(Boolean);
  if (!any && !useSync.getState().devMock) return;
  setTimeout(() => { void ensureEngine().catch(() => {}); }, 1500);
}

/** Sceglie il transport in base alle impostazioni (server finto di sviluppo oppure nessuno) e prova a collegarlo. */
export async function applyTransport(): Promise<{ ok: boolean; message: string }> {
  const s = useSync.getState();
  const saved = await loadServerConfig();
  /* indirizzo e chiave pubblica possono arrivare dalla build (EXPO_PUBLIC_SUPABASE_*): non sono segreti */
  const cfg = { url: saved.url || process.env.EXPO_PUBLIC_SUPABASE_URL || '', anonKey: saved.anonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' };
  /* 'disconnected' e' il valore iniziale: non deve bloccare il collegamento quando indirizzo e chiave ci sono */
  const chosen = s.transportName && s.transportName !== 'disconnected' ? s.transportName : '';
  const name = s.devMock ? 'mock-server' : chosen || (cfg.url && cfg.anonKey ? 'supabase' : 'disconnected');
  transport = createTransport(name, { url: cfg.url || s.serverUrl, anonKey: cfg.anonKey, deviceId: useSyncData.getState().deviceId, deviceName: s.deviceName || 'Questo telefono' });
  const r = await transport.connect({ url: cfg.url || s.serverUrl, anonKey: cfg.anonKey, deviceId: useSyncData.getState().deviceId, deviceName: s.deviceName || 'Questo telefono' }).catch(() => ({ ok: false, message: 'Non riesco a collegarmi al server.' }));
  engine?.refreshStatus();
  return r;
}

/** Abilita o disabilita una categoria (avvia il motore se serve). */
export async function setCategory(category: string, on: boolean): Promise<{ ok: boolean; error?: string }> {
  const e = await ensureEngine();
  return e.setCategoryEnabled(category, on);
}

export async function syncNow() { const e = await ensureEngine(); return e.syncNow(); }

/** Risolve una copia in conflitto di una nota: 'current' tiene la versione attuale, 'copy' usa la copia, 'both' le tiene entrambe. */
export function resolveConflict(conflictId: string, choice: 'current' | 'copy' | 'both') {
  const e = engine;
  const c = useSync.getState().conflicts.find((x) => x.id === conflictId);
  if (!e || !c || c.collection !== 'life.notes') return false;
  const life = useLife.getState();
  const copy = life.notes.find((n) => n.id === c.copyId);
  if (choice === 'copy' && copy) life.saveNote(c.entityId, copy.text);
  if (choice !== 'both' && copy) life.delNote(c.copyId);
  e.markConflict(conflictId, choice);
  return true;
}
