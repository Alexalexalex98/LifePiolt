import { Platform } from 'react-native';

import { t } from '@/i18n/core';
import { log } from '@/lib/log';
import { planMemos } from '@/lib/memo';
import { buildRef, pushData } from '@/lib/notifyLinks';
import { KINDS } from '@/lib/notifyKinds';
import { cancelByPrefix, ensureHandler, ensureKindChannels, isSupported, native } from '@/lib/notify';
import { useApp } from '@/store/app';
import { kindEnabled } from '@/lib/notifyKinds';
import { useMemos } from '@/store/memos';

const PREFIX = 'lp-rem-';
let busy = false, again = false;

/** Programma le notifiche dei promemoria (le prossime occorrenze di ognuno). Si rifà a ogni modifica e a ogni apertura dell'app. */
export async function refreshMemos(): Promise<void> {
  const N = native();
  if (!isSupported() || !N) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      ensureHandler();
      await cancelByPrefix(PREFIX);
      const st = await N.getPermissionsAsync();
      if (st.status !== 'granted' || !kindEnabled(useApp.getState().notifKinds, 'promemoria')) continue;
      await ensureKindChannels();
      const plan = planMemos(useMemos.getState().memos, Date.now(), 24);
      for (const p of plan) {
        try {
          await N.scheduleNotificationAsync({
            identifier: p.id,
            content: { title: t('Promemoria'), body: p.text, sound: true, interruptionLevel: 'timeSensitive', data: { ...pushData(buildRef('reminder', 'note'), 'promemoria'), memo: p.memoId } },
            trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(p.at), ...(Platform.OS === 'android' ? { channelId: KINDS.promemoria.channel.id } : {}) },
          });
        } catch (e) { log.warn('notify', 'Promemoria non programmabile', String(e)); }
      }
    } while (again);
  } catch (e) { log.warn('notify', 'Riprogrammazione dei promemoria fallita', String(e)); } finally { busy = false; }
}

let started = false;
/** Riprogramma quando cambiano i promemoria (con una breve attesa) e una volta all'avvio. */
export function startMemoSync(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  useMemos.subscribe((s, p) => { if (s.memos === p.memos) return; if (timer) clearTimeout(timer); timer = setTimeout(() => { void refreshMemos(); }, 800); });
  void refreshMemos();
}

/** Dopo aver creato un promemoria: se le notifiche non sono ancora consentite, le chiede (altrimenti non suonerebbe niente). */
export function ensureMemoPermission(): void {
  try { (require('@/lib/notifyPermission') as typeof import('@/lib/notifyPermission')).offerNotifications('event'); } catch { /* ignore */ }
}
