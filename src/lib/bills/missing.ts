/**
 * Bollette e pagamenti RICORRENTI che non sono stati segnati: se un mese manca (la scadenza stimata è passata senza che arrivasse o fosse pagata
 * la bolletta, o la serie si è interrotta) l'app lo nota e chiede com'è andata. Modulo PURO.
 */
import { addMonths, diffDays } from './dates.ts';
import type { Invoice, Recurrence } from './types.ts';

export const REC_STEP: Record<Recurrence, number> = { monthly: 1, bimonthly: 2, quarterly: 3, yearly: 12 };
export const GRACE_DAYS = 3;
export const ASK_AGAIN_DAYS = 7;

export type Missing = { kind: 'estimated' | 'gap'; /** la bolletta stimata (kind estimated) o l'ultima della serie (gap) */ invoiceId: string; issuer: string; expectedDue: string; amount: number; currency: string; recurrence: Recurrence };

/** Le scadenze ricorrenti mancanti, dalla più vecchia. `today` e' AAAA-MM-GG. */
export function findMissing(invoices: Invoice[], today: string): Missing[] {
  const out: Missing[] = [];
  const asked = (i: Invoice) => i.askedAt != null && diffDays(i.askedAt, today) < ASK_AGAIN_DAYS;
  // 1) la scadenza stimata dalla ricorrenza e' passata e la bolletta e' ancora aperta, mai confermata
  for (const i of invoices) {
    if (i.state !== 'open' || !i.estimated || !i.recurrence || !i.dueDate) continue;
    if (diffDays(i.dueDate, today) > GRACE_DAYS && !asked(i)) out.push({ kind: 'estimated', invoiceId: i.id, issuer: i.issuer, expectedDue: i.dueDate, amount: i.amount, currency: i.currency, recurrence: i.recurrence });
  }
  // 2) la serie si e' fermata: l'ultima bolletta e' pagata, la prossima doveva esserci e non c'e' piu' nulla di aperto per quell'emittente
  const bySeries = new Map<string, Invoice[]>();
  for (const i of invoices) if (i.recurrence && i.dueDate) { const k = `${i.issuer.toLowerCase()}|${i.kind}`; bySeries.set(k, [...(bySeries.get(k) ?? []), i]); }
  for (const list of bySeries.values()) {
    const last = [...list].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).at(-1)!;
    if (last.state === 'open' || !last.recurrence || !last.dueDate) continue;
    if (list.some((i) => i.state === 'open')) continue;
    const exp = addMonths(last.dueDate, REC_STEP[last.recurrence]);
    if (diffDays(exp, today) > GRACE_DAYS && !asked(last)) out.push({ kind: 'gap', invoiceId: last.id, issuer: last.issuer, expectedDue: exp, amount: last.amount, currency: last.currency, recurrence: last.recurrence });
  }
  return out.sort((a, b) => a.expectedDue.localeCompare(b.expectedDue));
}
