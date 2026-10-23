import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { snapshotAll, wipeStorage, getEngine } from '@/db';
import { BackupCryptoError, decryptBackup, encryptBackup, isLpBackupText } from '@/db/crypto';
import { initRandom } from '@/db/random';
import { useAccount } from '@/store/account';
import { useApp } from '@/store/app';
import { useAssistant } from '@/store/assistant';
import { useChat } from '@/store/chat';
import { useContext } from '@/store/context';
import { useDiscover } from '@/store/discover';
import { useAiRouter } from '@/store/aiRouter';
import { useIdentity } from '@/store/identity';
import { useInterests } from '@/store/interests';
import { usePrivacyLog } from '@/store/privacyLog';
import { useClub } from '@/store/club';
import { useSharing } from '@/store/sharing';
import { useSync } from '@/store/sync';
import { useTour } from '@/store/tour';
import { useCalPrefs } from '@/store/calprefs';
import { useMod } from '@/store/moderation';
import { useSecurity } from '@/db/securityStore';
import { useLive } from '@/store/live';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useJobs } from '@/store/jobs';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { usePrefs } from '@/store/prefs';
import { useTheia } from '@/store/theia';
import { useTravel } from '@/store/travel';

import { backupFileName, buildBackup, serializeBackup, storeVersions, toStorageEntries, validateBackup, type BackupPreview, type ValidateResult } from './backupCore';
import { resetSearch } from './search';

export { STORE_LABELS, type BackupPreview } from './backupCore';

type Rehydratable = { persist: { rehydrate: () => Promise<void> | void; getOptions: () => { name?: string } }; getState: () => { reset?: () => void } };

/** Tutti gli store persistenti (chiave AsyncStorage lp2-*). Se ne aggiungi uno nuovo, mettilo qui. */
const STORES = [useApp, useLife, useHealth, useFin, useTravel, useNet, useChat, useJobs, useContext, useAssistant, useDiscover, usePrefs, useTheia, useInterests, useIdentity, useLive, useSharing, useSync, useTour, useAiRouter, usePrivacyLog, useClub, useCalPrefs, useMod] as unknown as Rehydratable[];

const version = () => Constants.expoConfig?.version ?? '';

/** Tutti i dati salvati (include le modifiche non ancora scritte). */
const readAll = () => snapshotAll();

/** Crea il testo JSON del backup con tutti i dati salvati. */
export async function createBackupText(): Promise<string> {
  const raw = await readAll();
  delete raw['lp2-security']; // il blocco app e' una scelta di questo telefono, non un dato da portare altrove
  return serializeBackup(buildBackup(raw, version()));
}

/** Esporta: su web scarica il file, su telefono apre il foglio di condivisione. Con `password` il file e' cifrato (.lpbackup, AES-256-GCM). */
export async function exportBackup(opts: { password?: string; onProgress?: (p: number) => void } = {}): Promise<{ ok: boolean; message: string }> {
  try {
    const plain = await createBackupText();
    const encrypted = !!opts.password;
    if (encrypted) initRandom(); // Hermes non ha crypto.getRandomValues: uso la fonte di expo-crypto
    const text = encrypted ? await encryptBackup(plain, opts.password as string, {}, opts.onProgress) : plain;
    const name = backupFileName(new Date(), encrypted);
    const mime = encrypted ? 'application/octet-stream' : 'application/json';
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
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
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Backup LifePilot', UTI: encrypted ? 'public.data' : 'public.json' });
    // il file in cache contiene i dati: lo tolgo appena condiviso
    try { file.delete(); } catch { /* ignore */ }
    return { ok: true, message: encrypted ? 'Backup cifrato pronto' : 'Backup pronto' };
  } catch (e) {
    if (e instanceof BackupCryptoError) return { ok: false, message: e.message };
    return { ok: false, message: 'Non sono riuscito a creare il backup' + (e instanceof Error && e.message ? ': ' + e.message.slice(0, 100) : '.') };
  }
}

export type PickedBackup = { ok: true; text: string; preview: BackupPreview } | { ok: false; canceled?: boolean; error: string; /** file .lpbackup: serve la password (vedi openEncryptedBackup) */ needsPassword?: boolean; text?: string };

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
  if (isLpBackupText(text)) return { ok: false, needsPassword: true, text, error: 'Questo è un backup cifrato: serve la password. Importalo da Sicurezza.' };
  const v: ValidateResult = validateBackup(text);
  return v.ok ? { ok: true, text, preview: v.preview } : { ok: false, error: v.error };
}

/** Decifra un backup .lpbackup con la password e lo valida come uno normale. */
export async function openEncryptedBackup(text: string, password: string, onProgress?: (p: number) => void): Promise<PickedBackup> {
  try {
    const plain = await decryptBackup(text, password, onProgress);
    const v = validateBackup(plain);
    return v.ok ? { ok: true, text: plain, preview: v.preview } : { ok: false, error: v.error };
  } catch (e) {
    return { ok: false, error: e instanceof BackupCryptoError ? e.message : 'Non riesco a leggere il backup cifrato.' };
  }
}

/** Svuota ogni store persistente: stato in memoria e chiavi salvate. Non tocca il registro errori. */
export async function wipeAllData(): Promise<void> {
  for (const s of STORES) { try { s.getState().reset?.(); } catch { /* store senza reset */ } }
  try { useDiscover.setState({ open: false }); useTheia.setState({ open: false, req: null, dismissed: {} }); } catch { /* ignore */ }
  // archivio SQLite (o localStorage sul web), file del database, chiave di cifratura e vecchia copia di AsyncStorage
  await wipeStorage();
  resetSearch();
  try { useSecurity.getState().reset(); } catch { /* ignore */ }
  try { useApp.getState().reset(); } catch { /* ignore */ }
  try { useAccount.getState().clear(); } catch { /* ignore */ }
  if (Platform.OS !== 'web') {
    // allegati delle chat salvati nella memoria dell'app e file temporanei
    try { const d = new Directory(Paths.document, 'chat'); if (d.exists) d.delete(); } catch { /* ignore */ }
    try { for (const item of new Directory(Paths.cache).list()) { try { item.delete(); } catch { /* in uso */ } } } catch { /* ignore */ }
  }
}

/** Sovrascrive i dati con quelli del backup (già validato) e ricarica gli store. Se qualcosa va storto torna ai dati di prima. */
export async function restoreBackup(text: string): Promise<{ ok: boolean; message: string }> {
  const v = validateBackup(text);
  if (!v.ok) return { ok: false, message: v.error };
  const engine = getEngine();
  const rehydrateAll = async (incoming: Record<string, unknown>) => {
    await engine.reloadCache();
    for (const s of STORES) {
      const name = s.persist.getOptions().name ?? '';
      if (!incoming[name]) { try { s.getState().reset?.(); } catch { /* ignore */ } }
      await s.persist.rehydrate();
    }
  };
  try {
    const before = await readAll(); // per tornare indietro se qualcosa va storto
    try {
      const entries = Object.fromEntries(toStorageEntries(v.backup));
      if (before['lp2-security'] && !entries['lp2-security']) entries['lp2-security'] = before['lp2-security']; // le impostazioni di blocco restano quelle di questo telefono
      await engine.replaceAll(entries, storeVersions(v.backup));
      await rehydrateAll(v.backup.stores);
    } catch (e) {
      try { await engine.replaceAll(before); await rehydrateAll(Object.fromEntries(Object.keys(before).map((k) => [k, 1]))); } catch { /* ignore */ }
      throw e;
    }
    resetSearch();
    return { ok: true, message: v.preview.repaired.length ? 'Dati ripristinati dal backup (alcuni campi non validi sono stati scartati)' : 'Dati ripristinati dal backup' };
  } catch (e) {
    return { ok: false, message: 'Ripristino non riuscito, i dati precedenti sono stati mantenuti' + (e instanceof Error && e.message ? ': ' + e.message.slice(0, 100) : '.') };
  }
}
