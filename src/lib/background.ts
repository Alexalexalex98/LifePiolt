/**
 * Lavoro in background affidabile: ricalcolo periodico di promemoria, bollette e briefing; riprogrammazione dopo riavvio,
 * cambio fuso o ora legale; pulizia (cestino 30 giorni, notifiche vecchie); gancio per le future abitudini dalla posizione.
 *
 * Modulo nativo: expo-background-task (WorkManager su Android, BGTaskScheduler su iOS) + expo-task-manager per definire il task.
 * Caricati con require() solo dove esistono (non su web, non in Expo Go): se mancano non succede nulla e lo stato lo spiega.
 * La logica "cosa ricalcolare e quando" e' pura e testata: backgroundPlan.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { emit } from '@/domain/events.ts';
import { errToString, log } from './log';
import { decide, emptyState, pruneNotifications, pruneTrash, type BgOutcome, type MaintState, type Source, type TaskId } from './backgroundPlan';
import { BACKGROUND_MIN_INTERVAL_MIN } from './backgroundPlan';

export const TASK_NAME = 'lifepilot-maintenance';
const KEY_STATE = 'lp-bg-state';
const KEY_LAST = 'lp-bg-last';

type BgModule = typeof import('expo-background-task');
type TmModule = typeof import('expo-task-manager');

const expoGo = Constants.executionEnvironment === 'storeClient';
const nativeOk = (Platform.OS === 'ios' || Platform.OS === 'android') && !expoGo;

let bg: BgModule | null | undefined;
let tm: TmModule | null | undefined;
function mods(): { bg: BgModule; tm: TmModule } | null {
  if (!nativeOk) return null;
  if (bg === undefined || tm === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      bg = require('expo-background-task') as BgModule;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      tm = require('expo-task-manager') as TmModule;
    } catch { bg = null; tm = null; }
  }
  return bg && tm ? { bg, tm } : null;
}

// ---------------------------------------------------------------- stato osservabile

export type BgStatus = {
  supported: boolean;
  reason: string;
  registered: boolean;
  /** stato dichiarato dal sistema: 'available' | 'restricted' | 'unknown' */
  system: 'available' | 'restricted' | 'unknown';
  last: BgOutcome | null;
};
export const useBgStatus = create<BgStatus>(() => ({
  supported: nativeOk,
  reason: Platform.OS === 'web' ? 'Non disponibile sul web.' : expoGo ? 'Non disponibile in Expo Go: serve l\'app installata.' : '',
  registered: false,
  system: 'unknown',
  last: null,
}));

async function loadJson<T>(key: string): Promise<T | null> {
  try { const raw = await AsyncStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

// ---------------------------------------------------------------- esecuzione

/** Aspetta che gli store persistenti siano caricati (in background parte tutto da zero). */
async function waitHydrated(timeoutMs = 8000): Promise<boolean> {
  const stores = await Promise.all([import('@/store/app'), import('@/store/life'), import('@/store/finance'), import('@/store/interests'), import('@/store/network')]);
  const list = [stores[0].useApp, stores[1].useLife, stores[2].useFin, stores[3].useInterests, stores[4].useNet];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (list.every((s) => s.persist.hasHydrated())) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

let habitProvider: (() => Promise<void>) | null = null;
/** Gancio per le future abitudini dalla posizione: chi lo implementa emette 'location.habit.detected'. Oggi nessun provider. */
export function setHabitProvider(fn: (() => Promise<void>) | null) { habitProvider = fn; }

let running: Promise<BgOutcome> | null = null;

/** Esegue la manutenzione dovuta. Non lancia mai; salva e pubblica l'esito. */
export function runMaintenance(source: Source, force?: TaskId[]): Promise<BgOutcome> {
  if (running) return running;
  running = (async () => {
    const t0 = Date.now();
    let out: BgOutcome = { ts: t0, source, ok: true, ran: [], clock: null, ms: 0 };
    try {
      const hydrated = await waitHydrated();
      if (!hydrated) throw new Error('Dati non ancora caricati');
      const notify = await import('./notify');
      const state = (await loadJson<MaintState>(KEY_STATE)) ?? emptyState();
      let permission: boolean | null = null;
      let scheduledCount: number | null = null;
      try {
        const N = notify.native();
        if (N) permission = (await N.getPermissionsAsync()).status === 'granted';
        const l = await notify.listScheduled();
        scheduledCount = l.ok ? l.items.length : null;
      } catch { /* sconosciuto */ }
      const now = Date.now();
      let tz = 'UTC';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* ignore */ }
      const d = decide({ now, state, tz, offsetMin: new Date(now).getTimezoneOffset(), scheduledCount, permission, source, platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web', habitsEnabled: !!habitProvider });
      const run = force?.length ? [...new Set([...d.run, ...force])] : d.run;
      out = { ...out, ran: run, clock: d.clock, notes: d.notes };
      if (d.clock) emit('clock.changed', { reason: d.clock === 'timezone' ? 'timezone' : 'dst' });
      for (const t of run) {
        try {
          if (t === 'reminders') await notify.refreshReminders();
          else if (t === 'bills') await (await import('./bills/schedule')).refreshBillReminders();
          else if (t === 'briefings') await notify.refreshBriefings();
          else if (t === 'cleanup') await cleanup();
          else if (t === 'habits') await habitProvider?.();
        } catch (e) { log.warn('background', `Compito ${t} fallito`, errToString(e)); out.ok = false; out.error = errToString(e).slice(0, 160); }
      }
      await AsyncStorage.setItem(KEY_STATE, JSON.stringify(force?.length ? { ...d.next, lastRun: { ...d.next.lastRun, ...Object.fromEntries(force.map((f) => [f, now])) } } : d.next));
    } catch (e) {
      out = { ...out, ok: false, error: errToString(e).slice(0, 160) };
      log.error('background', 'Manutenzione fallita', errToString(e));
    }
    out.ms = Date.now() - t0;
    (out.ran.length || !out.ok ? log.info : log.debug)('background', `Manutenzione (${source}): ${out.ok ? 'ok' : 'errore'}; eseguiti: ${out.ran.join(', ') || 'nessuno'}${out.clock ? '; ' + out.clock : ''}; ${out.ms} ms`);
    useBgStatus.setState({ last: out });
    try { await AsyncStorage.setItem(KEY_LAST, JSON.stringify(out)); } catch { /* ignore */ }
    return out;
  })().finally(() => { running = null; });
  return running;
}

/** Cestino a 30 giorni e notifiche in-app vecchie. */
async function cleanup() {
  const { useLife } = await import('@/store/life');
  const { useNet } = await import('@/store/network');
  const now = Date.now();
  const life = useLife.getState();
  const trash = pruneTrash(life.trash, now);
  if (trash.length !== (life.trash ?? []).length) useLife.setState({ trash });
  const net = useNet.getState();
  const notifs = pruneNotifications(net.notifications, now);
  if (notifs.length !== net.notifications.length) useNet.setState({ notifications: notifs });
}

// ---------------------------------------------------------------- task nativo

let defined = false;
/** Da chiamare nello scope globale (import di _layout): defineTask deve esistere anche quando l'app parte in background. */
export function defineBackgroundTask() {
  if (defined) return;
  defined = true;
  const m = mods();
  if (!m) return;
  try {
    m.tm.defineTask(TASK_NAME, async () => {
      const r = await runMaintenance('background');
      return r.ok ? m.bg.BackgroundTaskResult.Success : m.bg.BackgroundTaskResult.Failed;
    });
  } catch (e) { log.warn('background', 'defineTask non riuscito', errToString(e)); }
}

/** Registra il task periodico (idempotente, difensivo). Chiamare dopo l'onboarding. */
export async function registerBackground(): Promise<BgStatus> {
  const m = mods();
  if (!m) { useBgStatus.setState({ supported: false, registered: false }); return useBgStatus.getState(); }
  try {
    const st = await m.bg.getStatusAsync();
    const system = st === m.bg.BackgroundTaskStatus.Available ? 'available' : 'restricted';
    if (system === 'restricted') {
      useBgStatus.setState({ supported: true, system, registered: false, reason: 'Il sistema limita i task in background (risparmio energetico o impostazioni).' });
      return useBgStatus.getState();
    }
    defineBackgroundTask();
    if (!(await m.tm.isTaskRegisteredAsync(TASK_NAME))) await m.bg.registerTaskAsync(TASK_NAME, { minimumInterval: BACKGROUND_MIN_INTERVAL_MIN });
    useBgStatus.setState({ supported: true, system, registered: true, reason: '' });
    const last = await loadJson<BgOutcome>(KEY_LAST);
    if (last) useBgStatus.setState({ last });
  } catch (e) {
    useBgStatus.setState({ supported: true, registered: false, reason: 'Registrazione non riuscita: ' + errToString(e).slice(0, 120) });
    log.warn('background', 'Registrazione fallita', errToString(e));
  }
  return useBgStatus.getState();
}

export async function unregisterBackground(): Promise<void> {
  const m = mods();
  if (!m) return;
  try { if (await m.tm.isTaskRegisteredAsync(TASK_NAME)) await m.bg.unregisterTaskAsync(TASK_NAME); useBgStatus.setState({ registered: false }); } catch { /* ignore */ }
}

/** Legge l'ultimo esito salvato (anche da un'esecuzione in background di un altro avvio). */
export async function refreshBgStatus(): Promise<BgStatus> {
  const last = await loadJson<BgOutcome>(KEY_LAST);
  const m = mods();
  let registered = useBgStatus.getState().registered;
  if (m) { try { registered = await m.tm.isTaskRegisteredAsync(TASK_NAME); } catch { /* ignore */ } }
  useBgStatus.setState({ ...(last ? { last } : {}), registered });
  return useBgStatus.getState();
}

/** App in primo piano: verifica cambio fuso/ora legale e manutenzione scaduta. */
export function onForeground(): void { void runMaintenance('foreground'); }

/** Avvio dell'app (anche dopo un riavvio del telefono): ricalcola cio' che e' scaduto. */
export function onAppStart(): void {
  defineBackgroundTask();
  void registerBackground();
  void runMaintenance('foreground');
}

/** Diagnostica: forza tutti i compiti sulle notifiche adesso. */
export function runAllNow() { return runMaintenance('foreground', ['reminders', 'bills', 'briefings', 'cleanup']); }

/** Solo build di sviluppo: chiede al sistema di eseguire subito il task. */
export async function triggerForTesting(): Promise<boolean> {
  const m = mods();
  if (!m) return false;
  try { return await m.bg.triggerTaskWorkerForTestingAsync(); } catch { return false; }
}
