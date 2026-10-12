/** Raccolta dello stato per la pagina Diagnostica e per l'esportazione. Tutto difensivo: ogni sezione puo' mancare. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { useBgStatus, refreshBgStatus } from './background';
import { buildReport, type DiagInfo, type SchedInfo } from './diagnosticsReport';
import { useErrorLog } from './errorLog';
import { getEntries } from './log';
import { listScheduled, native } from './notify';

const tryP = async <T,>(fn: () => Promise<T>, fb: T): Promise<T> => { try { return await fn(); } catch { return fb; } };
const perm = (r: { status?: string; granted?: boolean; canAskAgain?: boolean } | null | undefined) => (!r ? 'n/d' : r.granted || r.status === 'granted' ? 'concesso' : r.status === 'undetermined' ? 'non chiesto' : r.canAskAgain === false ? 'negato (da Impostazioni)' : 'negato');

export async function readPermissions(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (Platform.OS === 'web') return { 'tutti': 'non applicabile sul web' };
  out.notifiche = perm(await tryP(async () => native()?.getPermissionsAsync() ?? null, null));
  out.posizione = perm(await tryP(async () => (await import('expo-location')).getForegroundPermissionsAsync(), null));
  out.fotocamera = perm(await tryP(async () => (await import('expo-camera')).Camera.getCameraPermissionsAsync(), null));
  out.microfono = perm(await tryP(async () => (await import('expo-audio')).getRecordingPermissionsAsync(), null));
  out.contatti = perm(await tryP(async () => (await import('expo-contacts')).getPermissionsAsync(), null));
  out.calendario = perm(await tryP(async () => (await import('expo-calendar')).getCalendarPermissionsAsync(), null));
  return out;
}

async function storageInfo() {
  return tryP(async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('lp'));
    const pairs = await AsyncStorage.multiGet(keys);
    const kb = Math.round(pairs.reduce((n, [, v]) => n + (v?.length ?? 0), 0) / 1024);
    let engine = 'AsyncStorage';
    let note: string | undefined;
    try {
      // motore di persistenza (src/db): se c'e', dice se SQLite e se i dati sono cifrati. Opzionale.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const st = (require('@/db/status') as typeof import('@/db/status')).getStorageInfo();
      engine = `${st.mode}, cifratura: ${st.encryption}`;
      note = st.encryptionNote || undefined;
    } catch { /* motore non disponibile: resta AsyncStorage */ }
    return { engine, keys: keys.length, kb, note };
  }, { engine: 'AsyncStorage', keys: 0, kb: 0, note: 'non leggibile' as string | undefined });
}

export async function collect(): Promise<DiagInfo> {
  const exp = Constants.expoConfig;
  const sched = await listScheduled();
  const scheduled: SchedInfo[] | null = sched.ok ? sched.items.map((s) => ({ id: s.id, at: s.at })) : null;
  let tz = 'n/d';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
  const bg = await refreshBgStatus();
  const permissions = await readPermissions();
  let voice: DiagInfo['voice'];
  try {
    const { speechDiagnostics } = await import('./speech');
    const d = await speechDiagnostics('it-IT');
    voice = { moduloCaricato: d.moduleLoaded, disponibile: d.available, onDevice: d.onDevice, microfono: d.micGranted, servizi: d.services?.length ?? null, servizioPredefinito: d.defaultService ?? null };
  } catch { /* nessun dato vocale */ }
  const runtime = Platform.OS === 'web' ? 'web' : Constants.executionEnvironment === 'storeClient' ? 'Expo Go' : 'app installata / development build';
  return {
    app: { name: 'LifePilot', version: exp?.version ?? '?', sdk: String(exp?.sdkVersion ?? Constants.expoVersion ?? '57'), build: String(exp?.ios?.buildNumber ?? exp?.android?.versionCode ?? '1'), runtime },
    device: { platform: Platform.OS, os: String(Device.osVersion ?? Platform.Version ?? ''), model: String(Device.modelName ?? 'n/d'), locale: (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return 'n/d'; } })(), tz },
    storage: await storageInfo(),
    notifications: { supported: !!native(), permission: permissions.notifiche ?? 'n/d', scheduled },
    background: { supported: bg.supported, registered: bg.registered, system: bg.system, reason: bg.reason, last: bg.last ? { ts: bg.last.ts, source: bg.last.source, ok: bg.last.ok, ran: bg.last.ran, clock: bg.last.clock, ms: bg.last.ms, error: bg.last.error } : null },
    permissions,
    ...(voice ? { voice } : {}),
    errors: useErrorLog.getState().entries.length,
    log: getEntries({ limit: 200 }).reverse(),
  };
}

export async function reportText(): Promise<string> { return buildReport(await collect()); }

/** Esporta il testo di diagnostica (web: scarica, telefono: foglio di condivisione). */
export async function exportDiagnostics(): Promise<{ ok: boolean; message: string }> {
  try {
    const text = await reportText();
    const name = `lifepilot-diagnostica-${new Date().toISOString().slice(0, 10)}.txt`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { ok: true, message: 'Diagnostica scaricata: ' + name };
    }
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(text);
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'La condivisione dei file non è disponibile su questo dispositivo.' };
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Diagnostica LifePilot', UTI: 'public.plain-text' });
    return { ok: true, message: 'Diagnostica pronta' };
  } catch (e) {
    return { ok: false, message: 'Non sono riuscito a creare la diagnostica' + (e instanceof Error && e.message ? ': ' + e.message.slice(0, 100) : '.') };
  }
}

export { useBgStatus };
