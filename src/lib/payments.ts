/**
 * Pagamenti in LifePoints tra persone, con QR proprietario (modulo PURO, nessun alias '@/').
 * Chiunque può inviare LifePoints a chiunque: dal QR, dalla chat o dalla pagina LifePoints.
 * Chi riceve sceglie se tenerli in LifePoints (nessuna commissione) o riceverli in denaro (commissione del 2,5%, a carico di chi riceve).
 */
export const CASH_FEE_PCT = 2.5;
export const MAX_PAY = 100000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export type ReceiveMode = 'lp' | 'cash';
export type PayVia = 'qr' | 'chat' | 'lifepoints';
export type PaymentRecord = {
  id: string; ts: number; dir: 'in' | 'out'; peer: string; /** LifePoints inviati (chi paga li paga sempre per intero) */ amount: number;
  mode: ReceiveMode; /** commissione trattenuta a chi riceve in denaro */ fee: number; /** ciò che arriva a chi riceve (LP o denaro) */ net: number;
  note: string; via: PayVia;
};

/** Cosa arriva a chi riceve: in LifePoints l'importo intero, in denaro meno la commissione del 2,5%. */
export function splitPayment(amount: number, mode: ReceiveMode): { gross: number; fee: number; net: number } {
  const g = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const fee = mode === 'cash' ? r2((g * CASH_FEE_PCT) / 100) : 0;
  return { gross: g, fee, net: r2(g - fee) };
}

/** Controlli prima di inviare: ritorna il messaggio d'errore oppure null. */
export function sendBlockReason(o: { from: string; to: string; amount: number; balance: number }): string | null {
  if (!o.to.trim()) return 'Scegli a chi inviare i LifePoints.';
  if (o.to.trim() === o.from.trim()) return 'Non puoi inviare LifePoints a te stesso.';
  if (!Number.isFinite(o.amount) || o.amount < 1) return 'Scrivi quanti LifePoints inviare (almeno 1).';
  if (!Number.isInteger(o.amount)) return 'Si inviano LifePoints interi.';
  if (o.amount > MAX_PAY) return `L'importo massimo è ${MAX_PAY} LP.`;
  if (o.balance < o.amount) return 'LifePoints insufficienti.';
  return null;
}

/* ---------- link / QR di pagamento ---------- */
export type PayRequest = { to: string; amount?: number; mode: ReceiveMode; /** cosa si sta pagando (es. alla cassa di un negozio) */ item?: string };
const PREFIX = 'lp://pay/';

/** Link da mettere nel QR: «lp://pay/<nome>?a=<importo>&m=c». Resta corto (il QR minimale arriva a 106 byte). */
export function buildPayLink(r: PayRequest): string {
  const q: string[] = [];
  if (r.amount && r.amount > 0) q.push(`a=${Math.round(r.amount)}`);
  if (r.mode === 'cash') q.push('m=c');
  if (r.item) q.push(`i=${encodeURIComponent(r.item.trim().slice(0, 28))}`);
  return `${PREFIX}${encodeURIComponent(r.to.trim())}${q.length ? '?' + q.join('&') : ''}`;
}
/** Legge un link di pagamento; null se non è valido (mai fidarsi di un codice letto: nome e importo vengono controllati). */
export function parsePayLink(text: string): PayRequest | null {
  const s = (text ?? '').trim();
  if (!s.startsWith(PREFIX)) return null;
  const rest = s.slice(PREFIX.length);
  const [namePart, query = ''] = rest.split('?');
  let to = '';
  try { to = decodeURIComponent(namePart); } catch { return null; }
  to = to.trim();
  if (!to || to.length > 60 || /[\u0000-\u001f<>]/.test(to)) return null;
  let amount: number | undefined;
  let mode: ReceiveMode = 'lp';
  let item = '';
  for (const kv of query.split('&').filter(Boolean)) {
    const [k, v = ''] = kv.split('=');
    if (k === 'a') { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= MAX_PAY) amount = n; else return null; }
    if (k === 'm') mode = v === 'c' ? 'cash' : 'lp';
    if (k === 'i') { try { item = decodeURIComponent(v).trim().slice(0, 28); } catch { return null; } if (/[\u0000-\u001f<>]/.test(item)) return null; }
  }
  return { to, ...(amount ? { amount } : {}), mode, ...(item ? { item } : {}) };
}
/** Il QR minimale entra fino a 106 byte: controlla che il link ci stia. */
export const payLinkFits = (link: string): boolean => new TextEncoder().encode(link).length <= 104;
