/** Scadenze delle bollette nel Plan (calendario): evento ambra con ref `bill:<id>`. Sempre su richiesta dell'utente, mai automatico. */
import { t } from '@/i18n/core';
import { useLife, type CalEvent } from '@/store/life';
import { dueItemsOf } from './plan';
import { billRef } from './reminders';
import type { Invoice } from './types';

export const BILL_EVENT_COLOR = 'amber';

export function billEventsOf(id: string): { day: string; idx: number; ev: CalEvent }[] {
  const ref = billRef(id);
  const out: { day: string; idx: number; ev: CalEvent }[] = [];
  const events = useLife.getState().events;
  for (const day of Object.keys(events)) (events[day] ?? []).forEach((ev, idx) => { if (ev.ref === ref) out.push({ day, idx, ev }); });
  return out;
}
export const isInCalendar = (id: string) => billEventsOf(id).length > 0;

/** Aggiunge un impegno per ogni scadenza ancora da pagare (alle 09:00, senza promemoria del Plan: li gestiscono le bollette). Restituisce i giorni aggiunti. */
export function addBillToCalendar(inv: Invoice, amountText: string): string[] {
  const life = useLife.getState();
  const ref = billRef(inv.id);
  const added: string[] = [];
  for (const d of dueItemsOf(inv)) {
    if ((useLife.getState().events[d.dueDate] ?? []).some((e) => e.ref === ref)) continue;
    const suffix = d.n ? ` (${t('rata {0}/{1}', d.n, d.of ?? d.n)})` : '';
    life.addEvent(d.dueDate, { time: '09:00', title: t('Scadenza {0}: {1}', inv.issuer + suffix, amountText), important: true, reminder: false, dur: 15, ref, color: BILL_EVENT_COLOR });
    added.push(d.dueDate);
  }
  return added;
}

/** Toglie dal calendario gli impegni della bolletta; restituisce cio' che e' stato tolto per l'annulla. */
export function removeBillFromCalendar(id: string): { day: string; idx: number; ev: CalEvent }[] {
  const found = billEventsOf(id).sort((a, b) => (a.day === b.day ? b.idx - a.idx : 0));
  const life = useLife.getState();
  found.forEach((f) => life.delEvent(f.day, f.idx));
  return found;
}
export function restoreBillEvents(list: { day: string; idx: number; ev: CalEvent }[]) {
  const life = useLife.getState();
  list.slice().sort((a, b) => a.idx - b.idx).forEach((f) => life.restoreEvent(f.day, f.idx, f.ev));
}
