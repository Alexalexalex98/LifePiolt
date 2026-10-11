import { useSyncExternalStore } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { create } from 'zustand';

import { ensureChannel, ensureHandler, isSupported, native, refreshAll } from '@/lib/notify';
import { useApp } from '@/store/app';

/**
 * Permesso di notifica: stato sempre noto (riletto quando l'app torna attiva), richiesta DOPO la creazione dei canali
 * (su Android 13+ il prompt POST_NOTIFICATIONS compare solo se esiste un canale e l'app lo chiede), pre-prompt calmo.
 *
 * Stati: granted = attive; undetermined = mai chieste (si può chiedere); denied = rifiutate ma si può richiedere;
 * blocked = rifiutate per sempre (solo dalle impostazioni di sistema); unsupported = web / Expo Go su Android.
 */
export type PermState = 'granted' | 'undetermined' | 'denied' | 'blocked' | 'unsupported';

type Snap = { state: PermState; checked: boolean };
let snap: Snap = { state: isSupported() ? 'undetermined' : 'unsupported', checked: false };
const listeners = new Set<() => void>();
const emit = (next: Snap) => { if (next.state === snap.state && next.checked === snap.checked) return; snap = next; listeners.forEach((l) => l()); };

type Resp = { status?: string; granted?: boolean; canAskAgain?: boolean };
/** Traduce la risposta di expo-notifications nello stato dell'app; se diventa 'granted' riprogramma tutto. */
export function syncPermission(r: Resp): PermState {
  let state: PermState;
  if (!isSupported()) state = 'unsupported';
  else if (r.granted || r.status === 'granted') state = 'granted';
  else if (r.status === 'undetermined') state = 'undetermined';
  else state = r.canAskAgain === false ? 'blocked' : 'denied';
  const was = snap.state;
  emit({ state, checked: true });
  if (state === 'granted' && was !== 'granted' && snap.checked) void refreshAll();
  return state;
}

export async function refreshPermission(): Promise<PermState> {
  const N = native();
  if (!N) { emit({ state: 'unsupported', checked: true }); return 'unsupported'; }
  try { return syncPermission(await N.getPermissionsAsync()); } catch { return snap.state; }
}

export const permissionNow = () => snap.state;
export function usePermission(): PermState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => snap.state, () => snap.state);
}
/** Le notifiche si possono ancora chiedere con il prompt di sistema? */
export const canAsk = (s: PermState) => s === 'undetermined' || s === 'denied';

/**
 * Chiede il permesso. Android: prima crea i canali (altrimenti il prompt di Android 13+ non compare), poi richiede.
 * iOS: alert, badge, suono. Non lancia mai.
 */
export async function askPermission(): Promise<PermState> {
  const N = native();
  if (!N) return 'unsupported';
  try {
    ensureHandler();
    await ensureChannel();
    const cur = await N.getPermissionsAsync();
    if (cur.status === 'granted') return syncPermission(cur);
    if (cur.canAskAgain === false) return syncPermission(cur);
    const next = await N.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    return syncPermission(next);
  } catch { return snap.state; }
}

/** Apre le impostazioni di sistema dell'app (dove si riattivano le notifiche rifiutate per sempre). */
export async function openSystemSettings(): Promise<void> {
  try { await Linking.openSettings(); } catch { /* ignore */ }
}

/** Android 12+: schermata "Sveglie e promemoria" (avvisi puntuali). Se non si apre, impostazioni dell'app. */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try { await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM'); } catch { await openSystemSettings(); }
}

/** True su Android 12+ (dove le sveglie esatte possono richiedere un'autorizzazione). */
export const exactAlarmRelevant = () => Platform.OS === 'android' && Number(Platform.Version) >= 31;

// ---------- pre-prompt ----------

export type PromptReason = 'tour' | 'event' | 'reminder' | 'manual';
export const useNotifPrompt = create<{ open: boolean; reason: PromptReason; show: (r: PromptReason) => void; hide: () => void }>((set) => ({
  open: false, reason: 'manual', show: (reason) => set({ open: true, reason }), hide: () => set({ open: false }),
}));

const MAX_AUTO = 2;
const MIN_GAP = 3 * 86400000;
let offerTimer: ReturnType<typeof setTimeout> | undefined;

/** Registra che il pre-prompt è stato visto (non insistere: massimo 2 proposte automatiche, a distanza di 3 giorni). */
export function noteAsked() {
  const a = useApp.getState();
  a.set({ notifAsk: { times: (a.notifAsk?.times ?? 0) + 1, lastAt: Date.now() } });
}

/**
 * Propone con calma il pre-prompt, ma solo al momento giusto: app pronta, utente registrato, nessun tour in corso, notifiche
 * ancora da chiedere, non già proposto troppe volte di recente. `manual` salta i controlli di frequenza.
 */
export function offerNotifications(reason: PromptReason): void {
  if (reason === 'manual') { useNotifPrompt.getState().show(reason); return; }
  if (!isSupported()) return;
  if (offerTimer) clearTimeout(offerTimer);
  offerTimer = setTimeout(async () => {
    try {
      const app = useApp.getState();
      if (!app.onboarded || app.reminders?.on === false) return;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const tour = (require('@/store/tour') as typeof import('@/store/tour')).useTour.getState();
      if (tour.active || tour.lockPrompt) return;
      const st = await refreshPermission();
      if (!canAsk(st)) return;
      const a = app.notifAsk ?? { times: 0, lastAt: 0 };
      if (a.times >= MAX_AUTO || Date.now() - a.lastAt < MIN_GAP) return;
      useNotifPrompt.getState().show(reason);
    } catch { /* mai bloccare l'app */ }
  }, 1200);
}

let watching = false;
/** Rilegge il permesso all'avvio e a ogni ritorno in primo piano; propone il pre-prompt dopo il benvenuto del tour. Idempotente. */
export function startPermissionWatch(): void {
  if (watching) return;
  watching = true;
  void refreshPermission();
  AppState.addEventListener('change', (st) => { if (st === 'active') void refreshPermission(); });
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTour } = require('@/store/tour') as typeof import('@/store/tour');
    useTour.subscribe((s, p) => { if (p.active === 'welcome' && s.active === null) offerNotifications('tour'); });
  } catch { /* ignore */ }
}
