import { create } from 'zustand';

import { emptyData, emptySettings, type StateAccess, type SyncData, type SyncSettings, type SyncState } from '@/sync/engine';
import type { SyncStatus } from '@/sync/types';
import { persisted } from './persist';

/**
 * Stato della sincronizzazione, in tre parti:
 *  - useSync ("sync"): scelte dell'utente e registri leggeri (categorie abilitate, server, cronologia invii, conflitti). Fa parte del backup;
 *  - useSyncData ("syncdata"): dati interni del motore (coda, cursore, metadati, impronte). Pesante e legato a questo telefono:
 *    NON fa parte del backup (dopo un ripristino il motore si risincronizza da solo);
 *  - useSyncStatus: stato osservabile in memoria (idle/syncing/error/offline, pendenti).
 * Il motore (src/sync/engine.ts) li usa tramite syncStateAccess.
 */
export const useSync = create<SyncSettings & { reset: () => void }>()(
  persisted<SyncSettings & { reset: () => void }>('sync', (set) => ({
    ...emptySettings(),
    reset: () => set({ ...emptySettings() }),
  }), (s) => { const { reset: _r, ...rest } = s; void _r; return rest as never; }),
);

export const useSyncData = create<SyncData>()(persisted<SyncData>('syncdata', () => ({ ...emptyData() })));

export const useSyncStatus = create<SyncStatus>(() => ({ phase: 'disconnected', pending: 0, blocked: 0 }));

const SETTINGS_KEYS = new Set(Object.keys(emptySettings()));

/** Ponte tra le due store persistite e il motore. */
export const syncStateAccess: StateAccess = {
  get: () => ({ ...useSyncData.getState(), ...useSync.getState() }) as SyncState,
  patch: (p) => {
    const a: Record<string, unknown> = {}, b: Record<string, unknown> = {};
    for (const k of Object.keys(p)) (SETTINGS_KEYS.has(k) ? a : b)[k] = (p as Record<string, unknown>)[k];
    if (Object.keys(a).length) useSync.setState(a as Partial<SyncSettings>);
    if (Object.keys(b).length) useSyncData.setState(b as Partial<SyncData>);
  },
};
