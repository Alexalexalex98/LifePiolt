/**
 * Negozi su LifePilot (modulo PURO, nessun alias '@/'): prodotti, ordini pagati in LifePoints, sconto da contributo a un'idea, resi.
 * Il negozio spedisce direttamente: qui si tiene solo lo stato dell'ordine e il canale di chat per resi e assistenza.
 */
export type Product = { id: string; shop: string; name: string; desc: string; /** prezzo in LifePoints */ price: number; stock: number; color: string; ts: number; /** foto (la prima è la copertina) e un video facoltativo */ images?: string[]; video?: string };
export type OrderStatus = 'pagato' | 'spedito' | 'consegnato' | 'reso';
export type Order = {
  id: string; shop: string; buyer: string; productId: string; name: string; qty: number;
  /** totale del prodotto, sconto da contributo e LifePoints realmente pagati */
  total: number; credit: number; paid: number;
  address: string; ts: number; status: OrderStatus; returnedAt?: number;
};

export const RETURN_DAYS = 14;
export const SHIP_AFTER_H = 24;
export const DELIVER_AFTER_H = 72;
const H = 3600000;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Quanto sconto da contributo si può usare su un acquisto e quanto resta da pagare. */
export function applyCredit(total: number, credit: number): { used: number; pay: number } {
  const used = Math.max(0, Math.min(r2(credit), total));
  return { used, pay: r2(total - used) };
}

/** Stato mostrato: gli ordini avanzano da soli con il tempo (il negozio li spedisce); un reso richiesto resta tale. */
export function statusAt(o: Pick<Order, 'ts' | 'status' | 'returnedAt'>, now: number): OrderStatus {
  if (o.status === 'reso' || o.returnedAt) return 'reso';
  const h = (now - o.ts) / H;
  return h >= DELIVER_AFTER_H ? 'consegnato' : h >= SHIP_AFTER_H ? 'spedito' : 'pagato';
}
export const STATUS_LABEL: Record<OrderStatus, string> = { pagato: 'Pagato', spedito: 'Spedito', consegnato: 'Consegnato', reso: 'Reso richiesto' };

/** Il reso si può chiedere entro RETURN_DAYS dalla consegna prevista (o dalla spedizione se già in viaggio non serve: si chiede dopo la consegna). */
export function canReturn(o: Pick<Order, 'ts' | 'status' | 'returnedAt'>, now: number): boolean {
  if (statusAt(o, now) !== 'consegnato') return false;
  return now - (o.ts + DELIVER_AFTER_H * H) <= RETURN_DAYS * 24 * H;
}

export const MAX_PRODUCT_PHOTOS = 6;

export function validateProduct(p: { name: string; price: number; stock: number }): string | null {
  if (p.name.trim().length < 2) return 'Scrivi il nome del prodotto.';
  if (!Number.isFinite(p.price) || p.price <= 0) return 'Il prezzo deve essere maggiore di zero.';
  if (p.price > 100000) return 'Il prezzo è troppo alto.';
  if (!Number.isInteger(p.stock) || p.stock < 0) return 'Le quantità disponibili non sono valide.';
  return null;
}
export function validateAddress(a: string): string | null {
  return a.trim().length < 8 ? 'Scrivi l\'indirizzo di spedizione completo.' : null;
}

/** Controlli prima di comprare (quantità, scorte, saldo). Ritorna il messaggio d'errore oppure null. */
export function buyBlockReason(p: Product | undefined, qty: number, balance: number, pay: number): string | null {
  if (!p) return 'Prodotto non trovato.';
  if (!Number.isInteger(qty) || qty < 1) return 'Scegli una quantità valida.';
  if (p.stock < qty) return p.stock === 0 ? 'Prodotto esaurito.' : `Ne restano solo ${p.stock}.`;
  if (balance < pay) return 'LifePoints insufficienti.';
  return null;
}

export const PRODUCT_COLORS = ['#6c8cff', '#e0866b', '#4fb58a', '#c9a24a', '#a46bd6', '#4fa7c9', '#d65f8a', '#6b7280'] as const;
