import * as Network from 'expo-network';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Stato di connessione. Non blocca mai nulla: serve solo a mostrare un avviso e a far scegliere
 * al codice il percorso senza rete (meteo e server AI richiedono internet, il resto no).
 */
const useOnlineStore = create<{ online: boolean }>(() => ({
  online: Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
}));

let started = false;
function start() {
  if (started) return;
  started = true;
  const set = (online: boolean) => { if (useOnlineStore.getState().online !== online) useOnlineStore.setState({ online }); };
  // isInternetReachable può essere null/undefined finché non è noto: offline solo se è esplicitamente falso
  const fromState = (st: { isConnected?: boolean; isInternetReachable?: boolean | null }) => set(!(st.isConnected === false || st.isInternetReachable === false));
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', () => set(true));
      window.addEventListener('offline', () => set(false));
      if (typeof navigator !== 'undefined') set(navigator.onLine !== false);
      return;
    }
    void Network.getNetworkStateAsync().then(fromState).catch(() => {});
    Network.addNetworkStateListener(fromState);
  } catch {
    // modulo non disponibile: si assume online
  }
}

/** true = connesso (o stato sconosciuto). */
export function useOnline(): boolean {
  useEffect(start, []);
  return useOnlineStore((s) => s.online);
}

/** Lettura puntuale fuori dai componenti (es. prima di chiamare meteo o server AI). */
export function isOnline(): boolean {
  start();
  return useOnlineStore.getState().online;
}

export const OFFLINE_MESSAGE = 'Sei offline: funzionano piano, task, note, assistente a comandi e report; meteo e server AI no';
