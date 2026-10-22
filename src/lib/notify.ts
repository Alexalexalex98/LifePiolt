import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/i18n/core';
import { errToString, log } from '@/lib/log';
import { buildPush, decidePush, dedupeKey, KIND_ORDER, KINDS, kindEnabled } from '@/lib/notifyKinds';
import { buildRef, pushData } from '@/lib/notifyLinks';
import { REPLY_ACTION, REPLY_CATEGORY, canReply } from '@/lib/quickReply';
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

/** Il modulo nativo, o null dove non esiste (web, Expo Go su Android). Mai lancia. */
export function native(): typeof NotificationsType | null {
  return isSupported() ? load() : null;
}

/** True se questa piattaforma può schedulare notifiche locali. */
export function isSupported(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !androidExpoGo;
}

let handlerSet = false;
export function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  try {
    // Android: con shouldPlaySound=false il banner a comparsa NON viene mostrato, nemmeno con priorita' alta (vedi i tipi di expo-notifications):
    // il suono lo decide il canale della categoria, qui lo lascio sempre acceso per le notifiche importanti.
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        const k = (n?.request?.content?.data as { kind?: string } | undefined)?.kind;
        const quiet = k === 'sociale' || k === 'sistema' || k === 'lifepoints';
        return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: !quiet, shouldSetBadge: false };
      },
    });
  } catch { /* non disponibile */ }
  // «Rispondi» nella notifica: si scrive un commento o un messaggio senza aprire l'app
  try {
    void Notifications.setNotificationCategoryAsync(REPLY_CATEGORY, [{
      identifier: REPLY_ACTION, buttonTitle: t('Rispondi'), options: { opensAppToForeground: false },
      textInput: { submitButtonTitle: t('Invia'), placeholder: t('Scrivi una risposta…') },
    }]);
  } catch { /* non disponibile */ }
}

export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Briefing giornalieri', importance: Notifications.AndroidImportance.DEFAULT, description: 'Riepilogo del mattino e della sera' });
  } catch { /* ignore */ }
  await ensureKindChannels();
}

/** Un canale Android per categoria (id stabili: nome, importanza, suono e vibrazione diversi). */
let kindChannelsDone = false;
export async function ensureKindChannels() {
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try { (require('@/lib/notifyPermission') as typeof import('@/lib/notifyPermission')).syncPermission(st); } catch { /* ignore */ }
    if (st.status !== 'granted') return { ok: false, reason: 'denied', message: 'Permesso negato: abilita le notifiche per LifePilot dalle impostazioni del telefono.' };
    return { ok: true, message: 'Notifiche consentite' };
  } catch {
    return { ok: false, reason: 'unsupported', message: 'Le notifiche non sono disponibili in questo ambiente (ad esempio Expo Go).' };
  }
}

const valid = (h: number, m: number) => Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24 && m >= 0 && m < 60;

/** Programma una notifica ripetuta ogni giorno. Sostituisce quella con lo stesso id. */
export async function scheduleDaily(id: string, hour: number, minute: number, title: string, body: string, data?: Record<string, unknown>): Promise<NotifyResult> {
  if (!valid(hour, minute)) return { ok: false, reason: 'error', message: 'Orario non valido.' };
  const perm = await requestPermission();
  if (!perm.ok) return perm;
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, ...(data ? { data } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    });
    return { ok: true, message: 'Notifica programmata' };
  } catch (e) {
    log.warn('notify', 'Programmazione notifica fallita', errToString(e));
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
  } catch (e) {
    log.warn('notify', 'Programmazione notifica fallita', errToString(e));
    return { ok: false, reason: 'error', message: 'Non sono riuscito a programmare la notifica.' };
  }
}

/**
 * Notifica locale una tantum a data/ora esatta. Sostituisce quella con lo stesso id, ignora date passate,
 * non chiede il permesso (lo fa il flusso dedicato) e non lancia mai. `channelKind` = id di categoria (es. 'finanza').
 */
export async function scheduleAt(id: string, when: Date, title: string, body: string, data?: Record<string, unknown>, channelKind?: string): Promise<NotifyResult> {
  if (!isSupported()) return { ok: false, reason: 'unsupported', message: 'Le notifiche sono disponibili solo sull\'app installata (non in Expo Go su Android).' };
  const at = when instanceof Date ? when.getTime() : NaN;
  if (!Number.isFinite(at) || at <= Date.now() + 1000) return { ok: false, reason: 'error', message: 'La data è già passata.' };
  try {
    ensureHandler();
    const st = await Notifications.getPermissionsAsync();
    if (st.status !== 'granted') return { ok: false, reason: 'denied', message: 'Le notifiche non sono consentite.' };
    await ensureKindChannels();
    const kind = channelKind && Object.prototype.hasOwnProperty.call(KINDS, channelKind) ? (channelKind as keyof typeof KINDS) : 'promemoria';
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true, data: { kind, ...(data ?? {}) } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), ...(Platform.OS === 'android' ? { channelId: KINDS[kind].channel.id } : {}) },
    });
    return { ok: true, message: 'Notifica programmata' };
  } catch (e) {
    log.warn('notify', 'Programmazione notifica fallita', errToString(e));
    return { ok: false, reason: 'error', message: 'Non sono riuscito a programmare la notifica.' };
  }
}

/** Annulla tutte le notifiche programmate il cui id inizia con `prefix`. */
export async function cancelByPrefix(prefix: string): Promise<void> {
  if (!isSupported() || !prefix) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) if (n.identifier.startsWith(prefix)) await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
  } catch { /* ignore */ }
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try { void require('@/lib/foodNotify').refreshFoodReminders(); } catch { /* promemoria del cibo non disponibili */ }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try { void require('@/lib/theia/notifyRadar').refreshRadarNotifications(); } catch { /* avvisi di Theia non disponibili */ }
  } catch (e) { log.warn('notify', 'Riprogrammazione briefing fallita', errToString(e)); /* mai bloccare l'app per una notifica */ }
}

// ---------- promemoria degli impegni ----------

let remBusy = false;
let remAgain = false;

/**
 * Riprogramma i promemoria degli impegni (anticipo, "Parti alle ...", "Inizia ora"): cancella i vecchi `lp-ev-*` e crea quelli
 * calcolati da planReminders. Non chiede mai il permesso da sola (lo fa il flusso in notifyPermission). Mai bloccante.
 * Ogni notifica porta `ref` = event:<giorno>:<indice>: il tocco apre il Plan su quel giorno.
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
            content: { title: p.title, body: p.body, sound: true, data: { ...pushData(buildRef('event', p.day, p.idx), 'promemoria'), day: p.day, idx: p.idx, type: p.kind } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.at), ...(Platform.OS === 'android' ? { channelId } : {}) },
          });
        } catch (e) { log.warn('notify', 'Promemoria non programmabile', errToString(e)); /* una notifica non programmabile non ferma le altre */ }
      }
    } while (remAgain);
  } catch (e) { log.warn('notify', 'Riprogrammazione promemoria fallita', errToString(e)); /* mai bloccare l'app per una notifica */ } finally { remBusy = false; }
}

export const PIN_ID = 'lp-urgent-pin';
/**
 * Notifica fissa «Urgenti oggi». Android: ongoing (non si scarta con uno swipe), canale silenzioso. iPhone: time-sensitive, resta nel centro
 * notifiche e sul blocco schermo finché non viene tolta (una vera attività sul blocco schermo richiederebbe codice nativo: Live Activity).
 */
export async function refreshUrgentPin(): Promise<void> {
  if (!isSupported()) return;
  try {
    ensureHandler();
    const app = useApp.getState();
    const st = await Notifications.getPermissionsAsync();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLife } = require('@/store/life') as typeof import('@/store/life');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { urgentPin } = require('@/lib/urgentPin') as typeof import('@/lib/urgentPin');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dayKey } = require('@/lib/format') as typeof import('@/lib/format');
    const life = useLife.getState();
    const d = new Date();
    const pin = st.status === 'granted' && app.reminders?.on !== false && app.reminders?.pin !== false ? urgentPin(life.events[dayKey()], life.tasks, d.getHours() * 60 + d.getMinutes()) : null;
    await Notifications.dismissNotificationAsync(PIN_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(PIN_ID).catch(() => undefined);
    if (!pin) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lp-urgent-pin', { name: 'Urgenti in vista', description: 'Impegni e task urgenti di oggi, sempre visibili', importance: Notifications.AndroidImportance.LOW, sound: null, enableVibrate: false });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: PIN_ID,
      content: { title: t(pin.title), body: pin.body, sound: false, sticky: true, autoDismiss: false, interruptionLevel: 'timeSensitive', data: pushData(buildRef('event', dayKey(), 0), 'promemoria') },
      trigger: Platform.OS === 'android' ? { channelId: 'lp-urgent-pin' } : null,
    });
  } catch (e) { log.warn('notify', 'Notifica urgenti non aggiornata', errToString(e)); }
}

/** Ricalcola tutto: promemoria impegni + briefing. Da chiamare dopo una concessione di permesso. */
export async function refreshAll(): Promise<void> {
  await refreshBriefings();
  await refreshReminders();
  await refreshUrgentPin();
}

let syncStarted = false;
/**
 * Riprogramma i promemoria quando cambiano impegni, preferenze o città di casa (con debounce). Idempotente.
 * Se compare un impegno con ora e le notifiche non sono ancora state chieste, propone il pre-prompt.
 */
export function startReminderSync(): void {
  if (syncStarted || !isSupported()) return;
  syncStarted = true;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pinTimer: ReturnType<typeof setTimeout> | undefined;
    const later = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { void refreshReminders(); }, 2000); };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLife } = require('@/store/life') as typeof import('@/store/life');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useInterests } = require('@/store/interests') as typeof import('@/store/interests');
    const timed = (e: Record<string, { time: string }[]>) => Object.values(e ?? {}).reduce((n, l) => n + (Array.isArray(l) ? l.filter((x) => /^\d{1,2}:\d{2}$/.test(x?.time ?? '')).length : 0), 0);
    useLife.subscribe((s, p) => {
      if (s.events === p.events) return;
      later();
      try {
        if (timed(s.events) > timed(p.events)) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require('@/lib/notifyPermission') as typeof import('@/lib/notifyPermission')).offerNotifications('event');
        }
      } catch { /* ignore */ }
    });
    useLife.subscribe((s, p) => { if (s.tasks !== p.tasks || s.events !== p.events) { if (pinTimer) clearTimeout(pinTimer); pinTimer = setTimeout(() => { void refreshUrgentPin(); }, 1500); } });
    void refreshUrgentPin();
    useInterests.subscribe((s, p) => { if (s.homeCity !== p.homeCity) later(); });
    useApp.subscribe((s, p) => { if (s.reminders !== p.reminders || s.notifKinds !== p.notifKinds) { later(); void refreshUrgentPin(); } });
  } catch { syncStarted = false; }
}

// ---------- diagnostica ----------

export type ScheduledInfo = { id: string; title: string; body: string; at: number | null };

/** Notifiche programmate sul telefono (per l'elenco di diagnostica in Impostazioni), in ordine di data. */
export async function listScheduled(): Promise<{ ok: boolean; items: ScheduledInfo[]; message?: string }> {
  if (!isSupported()) return { ok: false, items: [], message: 'Disponibile solo sull\'app installata.' };
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const items: ScheduledInfo[] = [];
    for (const n of all) {
      const tr = n.trigger as unknown as { value?: number; date?: number | string | Date; type?: string } | null;
      let at: number | null = null;
      if (tr && typeof tr.value === 'number') at = tr.value;
      else if (tr && tr.date !== undefined) at = new Date(tr.date as never).getTime();
      if (at === null || !Number.isFinite(at)) {
        try { at = await Notifications.getNextTriggerDateAsync(n.trigger as never); } catch { at = null; }
      }
      items.push({ id: n.identifier, title: n.content.title ?? '', body: n.content.body ?? '', at: at && Number.isFinite(at) ? at : null });
    }
    items.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
    return { ok: true, items };
  } catch {
    return { ok: false, items: [], message: 'Non riesco a leggere le notifiche programmate.' };
  }
}

export const TEST_ID = 'lp-test';
/** Notifica di prova tra `seconds` secondi. Porta al Plan (ref reminder). */
export async function sendTest(seconds = 5): Promise<NotifyResult> {
  return scheduleAt(TEST_ID, new Date(Date.now() + seconds * 1000), t('Notifica di prova'), t('Funziona: così ti avviserò prima dei tuoi impegni. Tocca per aprire.'), pushData(buildRef('reminder'), 'promemoria'), 'promemoria');
}

// ---------- tocco sulle notifiche di sistema ----------

export type TapEvent = { id: string; data: unknown; /** azione scelta nella notifica (es. 'reply') e testo scritto */ action?: string; text?: string };

/** Ascolta i tocchi sulle notifiche di sistema (app aperta o in background). Restituisce la funzione per smettere. */
export function onNotificationTap(handler: (e: TapEvent) => void): () => void {
  const N = native();
  if (!N) return () => undefined;
  try {
    const sub = N.addNotificationResponseReceivedListener((r) => {
      const text = (r as unknown as { userText?: string }).userText;
      handler({ id: `${r.notification.request.identifier}|${r.notification.date}|${r.actionIdentifier ?? ''}`, data: r.notification.request.content.data, action: r.actionIdentifier, text });
    });
    return () => { try { sub.remove(); } catch { /* ignore */ } };
  } catch { return () => undefined; }
}

/** Tocco che ha avviato l'app da chiusa (cold start), se c'e'. */
export async function lastTap(): Promise<TapEvent | null> {
  const N = native();
  if (!N) return null;
  try {
    const r = await N.getLastNotificationResponseAsync();
    if (!r) return null;
    return { id: `${r.notification.request.identifier}|${r.notification.date}`, data: r.notification.request.content.data };
  } catch { return null; }
}

// ---------- notifica locale immediata per le notifiche in-app importanti ----------

const recentPush = new Map<string, number>();

/**
 * Chiamata da useNet.notify: se la categoria è abilitata ed è importante (servizio, seminario, messaggio, lavoro,
 * punto giornaliero LifePoints) emette subito una notifica locale col canale della categoria. Evita doppioni
 * (stessa notifica entro un minuto). Porta `ref` e `kind` (il tocco apre la destinazione esatta). Difensiva: non lancia mai.
 */
export async function pushForNotif(n: { type: string; text: string; urgent?: boolean; kind?: string; ref?: string; id?: number }): Promise<void> {
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
      content: { title: p.title, body: p.body, sound: p.sound, interruptionLevel: p.passive ? 'passive' : 'active', data: pushData(n.ref, p.kind, n.id), ...(canReply(n.ref) ? { categoryIdentifier: REPLY_CATEGORY } : {}) },
      trigger: Platform.OS === 'android' ? { channelId: p.channelId } : null,
    });
  } catch { /* mai bloccare l'app per una notifica */ }
}
