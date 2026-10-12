/** Fattura (ricevuta) dell'acquisto in LifePoints (modulo PURO). Si genera da un'iscrizione/prenotazione o da un ordine di un negozio. */
import { CANCEL_HOURS, escrowState, unlockAt, type EscrowState } from './booking.ts';

export type InvoiceLine = { label: string; qty: number; amount: number };
export type Invoice = {
  number: string; issuedAt: number; buyer: string; seller: string; kind: 'seminario' | 'sessione' | 'prodotto';
  lines: InvoiceLine[]; total: number; discount: number; paid: number;
  /** bloccato fino alla fine dell'evento / accreditato al venditore / nessun pagamento */
  state: EscrowState | 'pagato';
  unlockAt?: number; eventAt?: number; terms: string[];
};

/** Numero progressivo leggibile ricavato dall'id e dalla data (stabile: lo stesso acquisto ha sempre lo stesso numero). */
export function invoiceNumber(id: string, ts: number): string {
  const y = new Date(ts).getFullYear();
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000000;
  return `LP-${y}-${String(h).padStart(6, '0')}`;
}

type EnrLike = { id: string; kind: 'seminar' | 'service'; title: string; host: string; price: number; paid?: number; held?: boolean; releasedAt?: number; startsAt: number; durationMin: number; createdAt: number };
export function invoiceFromEnrollment(e: EnrLike, buyer: string, now: number): Invoice {
  const paid = e.paid ?? 0;
  const state = paid > 0 ? escrowState(e, now) : 'nessuno';
  return {
    number: invoiceNumber(e.id, e.createdAt), issuedAt: e.createdAt, buyer, seller: e.host, kind: e.kind === 'seminar' ? 'seminario' : 'sessione',
    lines: [{ label: e.kind === 'seminar' ? `Seminario: ${e.title}` : `Sessione: ${e.title}`, qty: 1, amount: e.price }], total: e.price, discount: 0, paid,
    state, unlockAt: unlockAt(e), eventAt: e.startsAt,
    terms: [
      `I LifePoints restano bloccati fino alla fine dell'evento e poi vengono accreditati a ${e.host}${e.host.endsWith('.') ? '' : '.'}`,
      `Puoi disdire fino a ${CANCEL_HOURS} ore prima dell'inizio con rimborso intero e riprogrammare quando vuoi.`,
    ],
  };
}

type OrderLike = { id: string; shop: string; name: string; qty: number; total: number; credit: number; paid: number; ts: number };
export function invoiceFromOrder(o: OrderLike, buyer: string): Invoice {
  return {
    number: invoiceNumber(o.id, o.ts), issuedAt: o.ts, buyer, seller: o.shop, kind: 'prodotto',
    lines: [{ label: o.name, qty: o.qty, amount: o.total }], total: o.total, discount: o.credit, paid: o.paid, state: 'pagato',
    terms: ['Il negozio spedisce direttamente.', 'Per resi e assistenza usa la chat con il negozio: il reso si chiede entro 14 giorni dalla consegna.'],
  };
}

export const STATE_LABEL: Record<Invoice['state'], string> = { bloccato: 'Bloccato fino alla fine', accreditato: 'Accreditato al venditore', rimborsato: 'Rimborsato', nessuno: 'Gratuito', pagato: 'Pagato' };

const d = (ts: number) => { const x = new Date(ts); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`; };
/** Testo condivisibile della fattura. */
export function invoiceText(i: Invoice): string {
  const L = [`Fattura ${i.number}`, `Data: ${d(i.issuedAt)}`, `Acquirente: ${i.buyer}`, `Venditore: ${i.seller}`, ''];
  i.lines.forEach((l) => L.push(`${l.qty} × ${l.label}: ${l.amount} LP`));
  if (i.discount > 0) L.push(`Sconto: -${i.discount} LP`);
  L.push(`Totale pagato: ${i.paid} LP`, `Stato: ${STATE_LABEL[i.state]}${i.state === 'bloccato' && i.unlockAt ? ` (fino al ${d(i.unlockAt)})` : ''}`, '', ...i.terms);
  return L.join('\n');
}
