/**
 * Programmazione dei promemoria delle bollette sul telefono (notifiche LOCALI, nessun server).
 * Il calcolo di cosa e quando e' in reminders.ts (puro); qui si chiamano scheduleAt / cancelByPrefix di notify.ts.
 * Su web e in Expo Go (Android) non fa nulla: restituisce un esito spiegabile.
 */
import { AppState, Platform } from 'react-native';

import { t } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { cancelByPrefix, isSupported, scheduleAt } from '@/lib/notify';
import { pushData } from '@/lib/notifyLinks';
import { RESERVED_SLOTS } from '@/lib/reminders';
import { useFin } from '@/store/finance';
import { BILL_ID_PREFIX, billPrefix, planBillReminders, type PlannedReminder } from './reminders';

/** Slot per le bollette: i riservati agli "altri" (briefing + scadenze) meno i 2 dei briefing giornalieri. */
export const BILL_SLOTS = Math.max(4, RESERVED_SLOTS - 2);

export type RefreshResult = { supported: boolean; scheduled: number; deferred: number; failed: number };

let busy = false;
let again = false;

/**
 * Riprogramma i promemoria delle bollette: cancella i `lp-bill-*` e ricrea i piu' vicini (entro BILL_SLOTS); gli altri
 * vengono programmati alle chiamate successive, quando si liberano slot (avvio, ritorno in primo piano, ogni modifica).
 * Non chiede mai il permesso da sola. Mai bloccante.
 */
export async function refreshBillReminders(): Promise<RefreshResult> {
  const res: RefreshResult = { supported: isSupported(), scheduled: 0, deferred: 0, failed: 0 };
  if (!res.supported) return res;
  if (busy) { again = true; return res; }
  busy = true;
  try {
    do {
      again = false;
      const { invoices, billPrefs } = useFin.getState();
      await cancelByPrefix(BILL_ID_PREFIX);
      const plan = planBillReminders(invoices, billPrefs, {
        now: Date.now(), tr: t, maxSlots: BILL_SLOTS, fmt: (a, cur) => formatMoney(a, { currency: cur, decimals: 2 }),
      });
      res.deferred = plan.deferred.length;
      res.scheduled = 0; res.failed = 0;
      for (const p of plan.scheduled) {
        const r = await scheduleAt(p.id, new Date(p.at), p.title, p.body, pushData(p.ref, 'finanza'), 'finanza');
        if (r.ok) res.scheduled++;
        else if (r.reason === 'denied') { res.failed = plan.scheduled.length; break; }
        else res.failed++;
      }
    } while (again);
  } catch { /* mai bloccare l'app per una notifica */ } finally { busy = false; }
  return res;
}

/** Cancella subito i promemoria di una bolletta (pagata, eliminata o modificata). */
export async function cancelBillReminders(invoiceId: string): Promise<void> {
  try { await cancelByPrefix(billPrefix(invoiceId)); } catch { /* ignore */ }
}

/** Anteprima di cosa verra' programmato (per la schermata di pianificazione): non programma nulla. */
export function previewReminders(invoiceId: string): PlannedReminder[] {
  const { invoices, billPrefs } = useFin.getState();
  const inv = invoices.find((i) => i.id === invoiceId);
  if (!inv) return [];
  return planBillReminders([{ ...inv, remind: true }], billPrefs, { now: Date.now(), tr: t, maxSlots: 99, fmt: (a, cur) => formatMoney(a, { currency: cur, decimals: 2 }) }).all;
}

let started = false;
/** Riprogramma quando cambiano bollette o preferenze e quando l'app torna in primo piano. Idempotente. */
export function startBillReminderSync(): void {
  if (started || Platform.OS === 'web' || !isSupported()) return;
  started = true;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (ms = 1500) => { if (timer) clearTimeout(timer); timer = setTimeout(() => { void refreshBillReminders(); }, ms); };
    useFin.subscribe((s, p) => { if (s.invoices !== p.invoices || s.billPrefs !== p.billPrefs) later(); });
    AppState.addEventListener('change', (st) => { if (st === 'active') later(500); });
    later(500);
  } catch { started = false; }
}
