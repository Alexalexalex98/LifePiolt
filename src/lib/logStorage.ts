import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { loadPersisted, setStorage } from './log';

/** Collega il log a un file nella cartella documenti dell'app (su web: localStorage). Idempotente, non lancia mai. */
let started = false;
export function startLogStorage(): void {
  if (started) return;
  started = true;
  try {
    if (Platform.OS === 'web') {
      setStorage({
        load: async () => { try { return localStorage.getItem('lp-log'); } catch { return null; } },
        save: async (t) => { try { localStorage.setItem('lp-log', t); } catch { /* quota */ } },
      });
    } else {
      const f = () => new File(Paths.document, 'lifepilot-log.json');
      setStorage({
        load: async () => { const file = f(); return file.exists ? await file.text() : null; },
        save: async (t) => { const file = f(); if (!file.exists) file.create(); file.write(t); },
      });
    }
    void loadPersisted();
  } catch { /* log solo in memoria */ }
}
