import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { useApp } from '@/store/app';
import { useAssistant } from '@/store/assistant';
import { useChat } from '@/store/chat';
import { useContext } from '@/store/context';
import { useDiscover } from '@/store/discover';
import { useAiRouter } from '@/store/aiRouter';
import { useInterests } from '@/store/interests';
import { useSharing } from '@/store/sharing';
import { useTour } from '@/store/tour';
import { useLive } from '@/store/live';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useJobs } from '@/store/jobs';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { usePrefs } from '@/store/prefs';
import { useTheia } from '@/store/theia';
import { useTravel } from '@/store/travel';

import { backupFileName, buildBackup, serializeBackup, STORE_PREFIX, toStorageEntries, validateBackup, type BackupPreview, type ValidateResult } from './backupCore';

export { STORE_LABELS, type BackupPreview } from './backupCore';

type Rehydratable = { persist: { rehydrate: () => Promise<void> | void; getOptions: () => { name?: string } }; getState: () => { reset?: () => void } };

/** Tutti gli store persistenti (chiave AsyncStorage lp2-*). Se ne aggiungi uno nuovo, mettilo qui. */
const STORES = [useApp, useLife, useHealth, useFin, useTravel, useNet, useChat, useJobs, useContext, useAssistant, useDiscover, usePrefs, useTheia, useInterests, useLive, useSharing, useTour, useAiRouter] as unknown as Rehydratable[];

const version = () => Constants.expoConfig?.version ?? '';

async function readAll(): Promise<Record<string, string | null>> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(STORE_PREFIX));
  const pairs = await AsyncStorage.multiGet(keys);
  return Object.fromEntries(pairs);
}

/** Crea il testo JSON del backup con tutti i dati salvati. */
export async function createBackupText(): Promise<string> {
  return serializeBackup(buildBackup(await readAll(), version()));
}

/** Esporta: su web scarica il file, su telefono apre il foglio di condivisione. */
export async function exportBackup(): Promise<{ ok: boolean; message: string }> {
  try {
    const text = await createBackupText();
    const name = backupFileName();
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { ok: true, message: 'Backup scaricato: ' + name };
    }
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(text);
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'La condivisione dei file non è disponibile su questo dispositivo.' };
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Backup LifePilot', UTI: 'public.json' });
    return { ok: true, message: 'Backup pronto' };
  } catch (e) {
    return { ok: false, message: 'Non sono riuscito a creare il backup' + (e instanceof Error && e.message ? ': ' + e.message.slice(0, 100) : '.') };
  }
}

export type PickedBackup = { ok: true; text: string; preview: BackupPreview } | { ok: false; canceled?: boolean; error: string };

/** Fa scegliere un file e lo valida senza toccare i dati. */
export async function pickBackup(): Promise<PickedBackup> {
  try {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return { ok: false, canceled: true, error: '' };
    const a = r.assets[0];
    const text = Platform.OS === 'web' ? await (await fetch(a.uri)).text() : await new File(a.uri).text();
    return checkBackupText(text);
  } catch {
    return { ok: false, error: 'Non riesco a leggere il file scelto.' };
  }
}

export function checkBackupText(text: string): PickedBackup {
  const v: ValidateResult = validateBackup(text);
  return v.ok ? { ok: true, text, preview: v.preview } : { ok: false, error: v.error };
}

/** Svuota ogni store persistente: stato in memoria e chiavi salvate. Non tocca il registro errori. */
export async function wipeAllData(): Promise<void> {
  for (const s of STORES) { try { s.getState().reset?.(); } catch { /* store senza reset */ } }
  try { useDiscover.setState({ open: false }); useTheia.setState({ open: false, req: null, dismissed: {} }); } catch { /* ignore */ }
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(STORE_PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  try { useApp.getState().reset(); } catch { /* ignore */ }
  if (Platform.OS !== 'web') {
    // allegati delle chat salvati nella memoria dell'app e file temporanei
    try { const d = new Directory(Paths.document, 'chat'); if (d.exists) d.delete(); } catch { /* ignore */ }
    try { for (const item of new Directory(Paths.cache).list()) { try { item.delete(); } catch { /* in uso */ } } } catch { /* ignore */ }
  }
}

/** Sovrascrive i dati con quelli del backup (già validato) e ricarica gli store. */
export async function restoreBackup(text: string): Promise<{ ok: boolean; message: string }> {
  const v = validateBackup(text);
  if (!v.ok) return { ok: false, message: v.error };
  try {
    const before = await readAll(); // per tornare indietro se qualcosa va storto
    try {
      const keys = Object.keys(before);
      if (keys.length) await AsyncStorage.multiRemove(keys);
      await AsyncStorage.multiSet(toStorageEntries(v.backup));
      for (const s of STORES) {
        const name = s.persist.getOptions().name ?? '';
        if (!v.backup.stores[name]) { try { s.getState().reset?.(); } catch { /* ignore */ } }
        await s.persist.rehydrate();
      }
    } catch (e) {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(STORE_PREFIX));
      if (keys.length) await AsyncStorage.multiRemove(keys);
      const entries = Object.entries(before).filter((p): p is [string, string] => typeof p[1] === 'string');
      if (entries.length) await AsyncStorage.multiSet(entries);
      for (const s of STORES) { try { await s.persist.rehydrate(); } catch { /* ignore */ } }
      throw e;
    }
    return { ok: true, message: 'Dati ripristinati dal backup' };
  } catch (e) {
    return { ok: false, message: 'Ripristino non riuscito, i dati precedenti sono stati mantenuti' + (e instanceof Error && e.message ? ': ' + e.message.slice(0, 100) : '.') };
  }
}
