import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Registro locale degli ultimi errori dell'app.
 *  - resta sul telefono (chiave 'lp-errors', fuori dai backup e dalla cancellazione dei dati personali);
 *  - se EXPO_PUBLIC_ERROR_URL è impostata, invia in modo anonimo SOLO messaggio, versione app e piattaforma.
 */
export type ErrorEntry = { id: string; message: string; stack: string; screen: string; at: number };

const KEY = 'lp-errors';
const MAX = 50;
const ERROR_URL = process.env.EXPO_PUBLIC_ERROR_URL;

let screen = '';
/** Da chiamare quando cambia la schermata (Page lo fa già tramite trackVisit). */
export const setErrorScreen = (name: string) => { screen = name; };

function currentScreen() {
  if (screen) return screen;
  try { if (Platform.OS === 'web' && typeof location !== 'undefined') return location.pathname || '/'; } catch { /* ignore */ }
  return '';
}

type LogState = { entries: ErrorEntry[]; loaded: boolean; push: (e: ErrorEntry) => void; clear: () => void };
export const useErrorLog = create<LogState>((set, get) => ({
  entries: [],
  loaded: false,
  push: (e) => {
    const next = [e, ...get().entries].slice(0, MAX);
    set({ entries: next });
    void persist(next);
  },
  clear: () => { set({ entries: [] }); void persist([]); },
}));

async function persist(list: ErrorEntry[]) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list)); } catch { /* spazio finito o storage non disponibile */ }
}

/** Carica il registro salvato (una volta sola, unendolo agli errori già registrati in questa sessione). */
export async function loadErrorLog() {
  if (useErrorLog.getState().loaded) return;
  useErrorLog.setState({ loaded: true });
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const saved: ErrorEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(saved)) return;
    const cur = useErrorLog.getState().entries;
    const ids = new Set(cur.map((x) => x.id));
    useErrorLog.setState({ entries: [...cur, ...saved.filter((x) => x && typeof x.message === 'string' && !ids.has(x.id))].slice(0, MAX) });
  } catch { /* registro illeggibile: si riparte vuoto */ }
}

/** Toglie dai testi possibili dati personali: email, numeri lunghi, percorsi utente. */
export function scrub(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[numero]')
    .replace(/(\/Users|\/home|C:\\Users)[/\\][^\s/\\:)]+/g, '$1/[utente]');
}

export function makeEntry(e: unknown, context?: string, now = Date.now()): ErrorEntry {
  const err = e instanceof Error ? e : null;
  const message = scrub(err ? err.message : typeof e === 'string' ? e : (() => { try { return JSON.stringify(e); } catch { return String(e); } })() ?? String(e)).slice(0, 300);
  const stack = scrub(err?.stack ?? '').split('\n').slice(0, 8).join('\n').slice(0, 800);
  return { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, message: message || 'Errore sconosciuto', stack, screen: context || currentScreen(), at: now };
}

/** Registra un errore. Non lancia mai. `context` = nome della schermata o dell'azione. */
export function logError(e: unknown, context?: string) {
  try {
    const entry = makeEntry(e, context);
    useErrorLog.getState().push(entry);
    if (ERROR_URL) {
      void fetch(ERROR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: entry.message, appVersion: Constants.expoConfig?.version ?? '', platform: Platform.OS }),
      }).catch(() => undefined);
    }
  } catch { /* il registro non deve mai causare altri errori */ }
}

export function formatErrors(list: ErrorEntry[] = useErrorLog.getState().entries): string {
  const head = `LifePilot ${Constants.expoConfig?.version ?? ''} - ${Platform.OS} - ${list.length} problemi`;
  const body = list.map((x) => `[${new Date(x.at).toLocaleString('it-IT')}] ${x.screen || 'schermata sconosciuta'}\n${x.message}${x.stack ? '\n' + x.stack : ''}`).join('\n\n');
  return body ? head + '\n\n' + body : head;
}

void loadErrorLog();
