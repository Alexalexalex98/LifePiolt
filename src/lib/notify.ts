import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { Platform } from 'react-native';

import { buildPush, decidePush, dedupeKey, KIND_ORDER, KINDS, kindEnabled } from '@/lib/notifyKinds';
import { ID_PREFIX, planReminders } from '@/lib/reminders';
import { useApp } from '@/store/app';

/**
 * Notifiche LOCALI (nessun server). Tutto è difensivo: su web o in Expo Go senza permessi
 * le funzioni non fanno nulla e restituiscono un esito spiegabile.
 */
export type NotifyResult = { ok: boolean; reason?: 'unsupported' | 'denied' | 'error'; message: string };

const CHANNEL = 'briefing';
export const MORNING_ID = 'lp-briefing-morning';
export const EVENING_ID = 'lp-briefing-evening';

/** Su Android Expo Go il modulo lancia un errore già al caricamento: lo carico solo quando serve e solo dove esiste. */
const androidExpoGo = Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
let loaded: typeof NotificationsType | null | undefined;
function load(): typeof NotificationsType | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === 'web' || androidExpoGo) return (loaded = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-notifications') as typeof NotificationsType;
  } catch { loaded = null; }
  return loaded;
}
const Notifications = new Proxy({} as typeof NotificationsType, {
  get(_t, k) { const m = load(); if (!m) throw new Error('notifiche non disponibili'); return (m as never)[k]; },
});

/** True se questa piattaforma può schedulare notifiche locali. */
export function isSupported(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !androidExpoGo;
}

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch { /* non disponibile */ }
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Briefing giornalieri', importance: Notifications.AndroidImportance.DEFAULT, description: 'Riepilogo del mattino e della sera' });
  } catch { /* ignore */ }
  await ensureKindChannels();
}

/** Un canale Android per categoria (id stabili: nome, importanza, suono e vibrazione diversi). */
let kindChannelsDone = false;
async function ensureKindChannels() {
  if (kindChannelsDone || Platform.OS !== 'android') return;
  kindChannelsDone = true;
  for (const k of KIND_ORDER) {
    const c = KINDS[k].channel;
    try {
      await Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: Notifications.AndroidImportance[c.importance],
        sound: c.sound ? 'default' : null,
        enableVibrate: !!c.vibration,
        ...(c.vibration ? { vibrationPattern: c.vibration } : {}),
      });
    } catch { /* ignore */ }
  }
}

/** Chiede il permesso se serve. Restituisce true se le notifiche sono consentite. */
export async function requestPermission(): Promise<NotifyResult> {
  if (!isSupported()) return { ok: false, reason: 'unsupported', message: 'Le notifiche sono disponibili solo sull\'app installata (non in Expo Go su Android).' };
  try {
    ensureHandler();
    await ensureChannel();
    let st = await Notifications.getPermissionsAsync();
    if (st.status !== 'granted' && st.canAskAgain !== false) st = await Notifications.requestPermissionsAsync();
    if (st.status !== 'granted') return { ok: false, reason: 'denied', message: 'Permesso negato: abilita le notifiche per LifePilot dalle impostazioni del telefono.' };
    return { ok: true, message: 'Notifiche consentite' };
  } catch {
    return { ok: false, reason: 'unsupported', message: 'Le notifiche non sono disponibili in questo ambiente (ad esempio Expo Go).' };
  }
}

const valid = (h: number, m: number) => Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24 && m >= 0 && m < 60;

/** Programma una notifica ripetuta ogni giorno. Sostituisce quella con lo stesso id. */
export async function scheduleDaily(id: string, hour: number, minute: number, title: string, body: string): Promise<NotifyResult> {
  if (!valid(hour, minute)) return { ok: false, reason: 'error', message: 'Orario non valido.' };
  const perm = await requestPermission();
  if (!perm.ok) return perm;
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    });
    return { ok: true, message: 'Notifica programmata' };
  } catch {
    return { ok: false, reason: 'error', message: 'Non sono riuscito a programmare la notifica.' };
  }
}

/** Programma una notifica ripetuta ogni settimana. `weekday` come in Expo: 1 = domenica ... 7 = sabato. Sostituisce quella con lo stesso id. */
export async function scheduleWeekly(id: string, weekday: number, hour: number, minute: number, title: string, body: string): Promise<NotifyResult> {
  if (!valid(hour, minute) || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) return { ok: false, reason: 'error', message: 'Orario non valido.' };
  const perm = await requestPermission();
  if (!perm.ok) return perm;
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    });
    return { ok: true, message: 'Notifica programmata' };
  } catch {
    return { ok: false, reason: 'error', message: 'Non sono riuscito a programmare la notifica.' };
  }
}

export async function cancel(id: string): Promise<void> {
  if (!isSupported()) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* ignore */ }
}

export async function cancelAll(): Promise<void> {
  if (!isSupported()) return;
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}

export const parseHM = (s: string, fallback: [number, number]): [number, number] => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  if (!m) return fallback;
  const h = +m[1], mi = +m[2];
  return valid(h, mi) ? [h, mi] : fallback;
};

type Brief = { title: string; body: string };
function content(kind: 'morning' | 'evening'): Brief {
  const fallback: Brief = kind === 'morning'
    ? { title: 'Buongiorno', body: 'Apri LifePilot per vedere il piano di oggi.' }
    : { title: 'Riepilogo della giornata', body: 'Apri LifePilot per vedere com\'è andata oggi e preparare domani.' };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/lib/assistant/briefing');
    const fn = kind === 'morning' ? mod.buildMorning : mod.buildEvening;
    const r = typeof fn === 'function' ? fn() : null;
    if (r && typeof r.title === 'string' && typeof r.body === 'string') return { title: r.title, body: r.body.slice(0, 240) };
  } catch { /* briefing non disponibile */ }
  return fallback;
}

/**
 * Ricalcola il contenuto dei briefing e li riprogramma secondo le preferenze.
 * Da chiamare all'apertura dell'app e quando torna attiva. Non chiede mai il permesso da sola
 * (lo fa l'interruttore in Impostazioni): se manca, non programma nulla.
 */
export async function refreshBriefings(): Promise<void> {
  if (!isSupported()) return;
  startReminderSync();
  void refreshReminders();
  try {
    ensureHandler();
    const b = useApp.getState().briefing;
    if (!b) return;
    const st = await Notifications.getPermissionsAsync();
    const allowed = st.status === 'granted';
    for (const [id, on, at, kind, def] of [
      [MORNING_ID, b.morning, b.morningAt, 'morning', [7, 45]],
      [EVENING_ID, b.evening, b.eveningAt, 'evening', [20, 30]],
    ] as const) {
      if (!on || !allowed) { await cancel(id); continue; }
      const [h, m] = parseHM(at, def as unknown as [number, number]);
      const c = content(kind);
      await scheduleDaily(id, h, m, c.title, c.body);
    }
  } catch { /* mai bloccare l'app per una notifica */ }
}

// ---------- promemoria degli impegni ----------

let remBusy = false;
let remAgain = false;

/**
 * Riprogramma i promemoria degli impegni (anticipo + "Parti alle ..."): cancella i vecchi `lp-ev-*` e crea quelli
 * calcolati da planReminders. Non chiede mai il permesso da sola. Mai bloccante.
 */
export async function refreshReminders(): Promise<void> {
  if (!isSupported()) return;
  if (remBusy) { remAgain = true; return; }
  remBusy = true;
  try {
    do {
      remAgain = false;
      ensureHandler();
      const app = useApp.getState();
      const st = await Notifications.getPermissionsAsync();
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of existing) if (n.identifier.startsWith(ID_PREFIX)) await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
      const wanted = st.status === 'granted' && app.reminders?.on !== false && kindEnabled(app.notifKinds, 'promemoria');
      if (!wanted) continue;
      await ensureKindChannels();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const events = (require('@/store/life') as typeof import('@/store/life')).useLife.getState().events;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const homeCity = (require('@/store/interests') as typeof import('@/store/interests')).useInterests.getState().homeCity;
      const plan = planReminders(events, { now: Date.now(), prefs: app.reminders, homeCity });
      const channelId = KINDS.promemoria.channel.id;
      for (const p of plan) {
        try {
          await Notifications.scheduleNotificationAsync({
            identifier: p.id,
            content: { title: p.title, body: p.body, sound: true, data: { kind: 'promemoria', day: p.day, idx: p.idx } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.at), ...(Platform.OS === 'android' ? { channelId } : {}) },
          });
        } catch { /* una notifica non programmabile non ferma le altre */ }
      }
    } while (remAgain);
  } catch { /* mai bloccare l'app per una notifica */ } finally { remBusy = false; }
}

let syncStarted = false;
/** Riprogramma i promemoria quando cambiano impegni, preferenze o città di casa (con debounce). Idempotente. */
export function startReminderSync(): void {
  if (syncStarted || !isSupported()) return;
  syncStarted = true;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { void refreshReminders(); }, 2000); };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLife } = require('@/store/life') as typeof import('@/store/life');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useInterests } = require('@/store/interests') as typeof import('@/store/interests');
    useLife.subscribe((s, p) => { if (s.events !== p.events) later(); });
    useInterests.subscribe((s, p) => { if (s.homeCity !== p.homeCity) later(); });
    useApp.subscribe((s, p) => { if (s.reminders !== p.reminders || s.notifKinds !== p.notifKinds) later(); });
  } catch { syncStarted = false; }
}

// ---------- notifica locale immediata per le notifiche in-app importanti ----------

const recentPush = new Map<string, number>();

/**
 * Chiamata da useNet.notify: se la categoria è abilitata ed è importante (servizio, seminario, messaggio, lavoro,
 * punto giornaliero LifePoints) emette subito una notifica locale col canale della categoria. Evita doppioni
 * (stessa notifica entro un minuto). Difensiva: non lancia mai.
 */
export async function pushForNotif(n: { type: string; text: string; urgent?: boolean; kind?: string }): Promise<void> {
  try {
    if (!isSupported()) return;
    const app = useApp.getState();
    if (!app.notif?.push) return;
    const d = decidePush(n, app.notifKinds);
    if (!d.push) return;
    const key = dedupeKey(n.type, n.text);
    const now = Date.now();
    const last = recentPush.get(key);
    if (last !== undefined && now - last < 60000) return;
    recentPush.set(key, now);
    if (recentPush.size > 50) for (const [k, t0] of recentPush) if (now - t0 > 60000) recentPush.delete(k);
    ensureHandler();
    const st = await Notifications.getPermissionsAsync();
    if (st.status !== 'granted') return;
    await ensureKindChannels();
    const p = buildPush(n);
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, sound: p.sound, interruptionLevel: p.passive ? 'passive' : 'active', data: { kind: p.kind } },
      trigger: Platform.OS === 'android' ? { channelId: p.channelId } : null,
    });
  } catch { /* mai bloccare l'app per una notifica */ }
}
