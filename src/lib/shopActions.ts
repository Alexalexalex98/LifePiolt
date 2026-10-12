import { MAX_PRODUCT_PHOTOS, PRODUCT_COLORS, applyCredit, buyBlockReason, validateAddress, validateProduct, type Order, type Product } from '@/lib/shop';
import { SIGNAL } from '@/lib/relevance';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';

const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const productsOf = (shop: string): Product[] => (useNet.getState().products ?? []).filter((p) => p.shop === shop);
export const creditFor = (shop: string): number => useNet.getState().shopCredits?.[shop] ?? 0;

/** Il titolare aggiunge un prodotto al proprio negozio. Ritorna il messaggio d'errore o null. */
export function addProduct(shop: string, p: { name: string; desc: string; price: number; stock: number; images?: string[]; video?: string }): string | null {
  const err = validateProduct(p);
  if (err) return err;
  const list = useNet.getState().products ?? [];
  const prod: Product = { id: newId('pr'), shop, name: p.name.trim().slice(0, 60), desc: p.desc.trim().slice(0, 300), price: Math.round(p.price * 100) / 100, stock: p.stock, color: PRODUCT_COLORS[list.length % PRODUCT_COLORS.length], ts: Date.now(), images: (p.images ?? []).slice(0, MAX_PRODUCT_PHOTOS), video: p.video };
  useNet.setState({ products: [...list, prod] });
  return null;
}
export function removeProduct(id: string): Product | null {
  const list = useNet.getState().products ?? [];
  const p = list.find((x) => x.id === id) ?? null;
  if (p) useNet.setState({ products: list.filter((x) => x.id !== id) });
  return p;
}
export function restoreProduct(p: Product) {
  const list = useNet.getState().products ?? [];
  if (!list.some((x) => x.id === p.id)) useNet.setState({ products: [...list, p] });
}

/** Acquisto con LifePoints (usando prima lo sconto da contributo). Apre il canale di chat con il negozio per resi e assistenza. */
export function buyProduct(productId: string, qty: number, address: string): { ok: boolean; message: string; orderId?: string } {
  const net = useNet.getState();
  const me = useApp.getState().account.name;
  const p = (net.products ?? []).find((x) => x.id === productId);
  const total = p ? Math.round(p.price * qty * 100) / 100 : 0;
  const { used, pay } = applyCredit(total, creditFor(p?.shop ?? ''));
  const orderId = newId('or');
  const addrErr = validateAddress(address);
  if (addrErr) return { ok: false, message: addrErr };
  const block = buyBlockReason(p, qty, net.lifePoints, pay);
  if (block || !p) return { ok: false, message: block ?? 'Prodotto non trovato.' };
  if (p.shop === me) return { ok: false, message: 'Non puoi comprare dal tuo negozio.' };
  if (pay > 0 && !net.spend(pay, `Acquisto: ${p.name} · ${p.shop}`, p.shop, `ord:${orderId}`)) return { ok: false, message: 'LifePoints insufficienti.' };
  const order: Order = { id: orderId, shop: p.shop, buyer: me, productId: p.id, name: p.name, qty, total, credit: used, paid: pay, address: address.trim(), ts: Date.now(), status: 'pagato' };
  useNet.setState((s) => ({
    products: (s.products ?? []).map((x) => (x.id === p.id ? { ...x, stock: x.stock - qty } : x)),
    orders: [order, ...(s.orders ?? [])],
    shopCredits: used > 0 ? { ...(s.shopCredits ?? {}), [p.shop]: Math.max(0, (s.shopCredits?.[p.shop] ?? 0) - used) } : s.shopCredits,
  }));
  // canale con il negozio: ordine, indirizzo e, se serve, il reso
  const chat = useChat.getState();
  const id = chat.ensureDm(p.shop, me);
  chat.send(id, me, { kind: 'text', text: `Ordine ${order.id.slice(-6).toUpperCase()}: ${qty} × ${p.name} · ${total} LP${used ? ` (sconto ${used} LP)` : ''}. Spedizione a: ${order.address}` });
  useNet.getState().signal(`${p.name} ${p.desc}`, SIGNAL.buy);
  return { ok: true, message: 'Ordine pagato: il negozio lo spedisce', orderId: order.id };
}

/** Richiede il reso: lo segna sull'ordine e lo scrive nella chat con il negozio. */
export function requestReturn(orderId: string, reason: string): boolean {
  const me = useApp.getState().account.name;
  const o = (useNet.getState().orders ?? []).find((x) => x.id === orderId);
  if (!o) return false;
  useNet.setState((s) => ({ orders: (s.orders ?? []).map((x) => (x.id === orderId ? { ...x, status: 'reso' as const, returnedAt: Date.now() } : x)) }));
  const chat = useChat.getState();
  const id = chat.ensureDm(o.shop, me);
  chat.send(id, me, { kind: 'text', text: `Richiesta di reso per l'ordine ${o.id.slice(-6).toUpperCase()} (${o.name})${reason.trim() ? `: ${reason.trim()}` : '.'}` });
  return true;
}

export const openShopChat = (shop: string): string => useChat.getState().ensureDm(shop, useApp.getState().account.name);
