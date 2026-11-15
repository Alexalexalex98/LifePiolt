import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supa } from '@/lib/accountApi';
import { native, requestPermission } from '@/lib/notify';
import { useApp } from '@/store/app';

/**
 * Notifiche push mirate dal server (turni da confermare, turni da coprire, scambi, ferie, conferma del mese...).
 * Il telefono comunica al server il suo codice di notifica; il server lo usa solo per le notifiche destinate a questa persona.
 * Serve l'app installata (non Expo Go su Android), il permesso del sistema e un account sul server. In demo non si registra niente.
 */
let last = '';

/** Registra il telefono per ricevere le push. Con `ask` chiede anche il permesso (da usare quando l'utente entra in un gruppo di lavoro). */
export async function registerPush(ask = false): Promise<{ ok: boolean; reason?: string }> {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  if (useApp.getState().demo) return { ok: false, reason: 'demo' };
  const N = native(); if (!N) return { ok: false, reason: 'unsupported' };
  try {
    let st = await N.getPermissionsAsync();
    if (st.status !== 'granted' && ask) { const r = await requestPermission(); if (!r.ok) return { ok: false, reason: 'denied' }; st = await N.getPermissionsAsync(); }
    if (st.status !== 'granted') return { ok: false, reason: 'denied' };
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (!token || token === last) return { ok: true };
    await (await supa()).rpc('push_register', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    last = token; return { ok: true };
  } catch { return { ok: false, reason: 'error' }; }
}

/** All'uscita dall'account: il telefono smette di ricevere le notifiche di quella persona. */
export async function unregisterPush(): Promise<void> {
  try {
    const N = native(); if (!N || !last) return;
    await (await supa()).rpc('push_unregister', { p_token: last }); last = '';
  } catch { /* ignore */ }
}
