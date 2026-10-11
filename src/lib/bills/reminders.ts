/**
 * Promemoria locali delle bollette: calcolo PURO di cosa programmare e quando. La programmazione vera (expo-notifications)
 * sta in schedule.ts. Nessun server: le notifiche vengono create sul telefono.
 */
import { addDays, diffDays, isIso } from './dates.ts';
import { dueItemsOf } from './plan.ts';
import type { BillPrefs, Invoice } from './types.ts';

export type ReminderKind = 'd7' | 'd3' | 'd1' | 'd0' | 'o1' | 'o4' | 'o7';
export const REMINDER_KINDS: ReminderKind[] = ['d7', 'd3', 'd1', 'd0', 'o1', 'o4', 'o7'];
export const BILL_ID_PREFIX = 'lp-bill-';
/** Prefisso per cancellare tutti i promemoria di una bolletta (con il trattino finale: l'id 12 non cancella l'id 123). */
export const billPrefix = (invoiceId: string) => `${BILL_ID_PREFIX}${invoiceId}-`;
export const billReminderId = (invoiceId: string, kind: ReminderKind, installment?: number) => `${billPrefix(invoiceId)}${installment ? `i${installment}` : ''}${kind}`;
export const billRef = (invoiceId: string) => `bill:${invoiceId}`;

/** Numero massimo di notifiche riservate alle bollette (il telefono ne accetta ~64 in tutto, su iOS). */
export const DEFAULT_BILL_SLOTS = 14;

export type PlannedReminder = {
  id: string; at: number; title: string; body: string; invoiceId: string; kind: ReminderKind; ref: string; dueDate: string;
};
type Tr = (src: string, ...args: (string | number)[]) => string;
const fillTr: Tr = (src, ...args) => src.replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)] ?? ''));

const KIND_NAME: Record<Invoice['kind'], string> = {
  luce: 'Bolletta luce', gas: 'Bolletta gas', acqua: 'Bolletta acqua', internet: 'Internet e telefono', affitto: 'Affitto', assicurazione: 'Assicurazione',
  tasse: 'Tasse', abbonamento: 'Abbonamento', medico: 'Fattura medica', altro: 'Bolletta',
};

/** Momento (ms) di una data ISO alle hh:mm locali. */
export function atLocal(iso: string, hour: number, minute: number): number {
  return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), hour, minute, 0, 0).getTime();
}

export type RemindOpts = {
  now: number;
  tr?: Tr;
  /** Importo gia' formattato (es. "CHF 84,50"). */
  fmt: (amount: number, currency: string) => string;
  maxSlots?: number;
};

export function billLabel(inv: Pick<Invoice, 'kind' | 'issuer'>, tr: Tr = fillTr): string {
  const base = tr(KIND_NAME[inv.kind]);
  const iss = (inv.issuer ?? '').trim();
  return iss && !base.toLowerCase().includes(iss.toLowerCase()) ? `${base} ${iss}` : base;
}

/**
 * Tutti i promemoria futuri richiesti dalle preferenze, ordinati per momento, divisi in "da programmare adesso"
 * (i piu' vicini, entro il tetto di slot) e "rimandati" (si programmano quando si liberano slot).
 */
export function planBillReminders(invoices: Invoice[], prefs: BillPrefs, o: RemindOpts): { scheduled: PlannedReminder[]; deferred: PlannedReminder[]; all: PlannedReminder[] } {
  const tr = o.tr ?? fillTr;
  const all: PlannedReminder[] = [];
  if (prefs.on) {
    for (const inv of invoices) {
      if (inv.state !== 'open' || !inv.remind) continue;
      for (const d of dueItemsOf(inv)) {
        if (!isIso(d.dueDate)) continue;
        const label = billLabel(inv, tr) + (d.n ? ` (${tr('rata {0}/{1}', d.n, d.of ?? d.n)})` : '');
        const money = o.fmt(d.amount, inv.currency);
        const mk = (kind: ReminderKind, offset: number, title: string, body: string) => {
          const day = addDays(d.dueDate, offset);
          const at = atLocal(day, prefs.hour, prefs.minute);
          if (at <= o.now + 60000) return;
          all.push({ id: billReminderId(inv.id, kind, d.n), at, title, body, invoiceId: inv.id, kind, ref: billRef(inv.id), dueDate: d.dueDate });
        };
        const tDue = tr('Bolletta in scadenza'), tOver = tr('Bolletta scaduta');
        if (prefs.d7) mk('d7', -7, tDue, tr('{0}: {1} scade tra 7 giorni', label, money));
        if (prefs.d3) mk('d3', -3, tDue, tr('{0}: {1} scade tra 3 giorni', label, money));
        if (prefs.d1) mk('d1', -1, tDue, tr('{0}: {1} scade domani', label, money));
        if (prefs.d0) mk('d0', 0, tDue, tr('{0}: {1} scade oggi, paga per evitare solleciti', label, money));
        if (prefs.overdue) {
          const late = tr('{0}: {1} e\' scaduta, paga per evitare solleciti', label, money);
          mk('o1', 1, tOver, late); mk('o4', 4, tOver, late); mk('o7', 7, tOver, late);
        }
      }
    }
  }
  all.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const cap = Math.max(0, o.maxSlots ?? DEFAULT_BILL_SLOTS);
  return { scheduled: all.slice(0, cap), deferred: all.slice(cap), all };
}

/** Giorni dalla scadenza (utile per testi e ordinamenti): negativo = scaduta. */
export const daysUntil = (today: string, due: string) => diffDays(today, due);
