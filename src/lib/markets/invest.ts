/**
 * Compravendita in LifePoints (modulo PURO). L'utente indica quanti LP investire; l'app li converte in valuta reale al cambio
 * del momento, compra il titolo e poi mostra sempre il valore in LP: è ciò che riceverebbe vendendo adesso.
 * Quote frazionate (fino a 6 decimali), nessuna commissione mostrata all'utente.
 */
export type Position = { sym: string; units: number; /** LP spesi per questa posizione, al netto delle vendite */ costLp: number };
export type Order = { id: string; sym: string; side: 'buy' | 'sell'; units: number; priceLp: number; amountLp: number; ts: number };
export const MIN_ORDER_LP = 1;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export type Trade = { ok: true; position: Position | null; units: number; amountLp: number } | { ok: false; error: string };

export function buy(pos: Position | undefined, sym: string, amountLp: number, priceLp: number, balanceLp: number): Trade {
  if (!(priceLp > 0)) return { ok: false, error: 'Prezzo non disponibile' };
  const amt = r2(amountLp);
  if (!(amt >= MIN_ORDER_LP)) return { ok: false, error: `Importo minimo ${MIN_ORDER_LP} LP` };
  if (amt > balanceLp) return { ok: false, error: 'Saldo LifePoints insufficiente' };
  const units = r6(amt / priceLp);
  if (units <= 0) return { ok: false, error: 'Importo troppo piccolo' };
  return { ok: true, units, amountLp: amt, position: { sym, units: r6((pos?.units ?? 0) + units), costLp: r2((pos?.costLp ?? 0) + amt) } };
}
/** `amountLp` = quanto ricevere in LP; usa `all` per chiudere la posizione. */
export function sell(pos: Position | undefined, amountLp: number | 'all', priceLp: number): Trade {
  if (!pos || pos.units <= 0) return { ok: false, error: 'Non hai questo titolo' };
  if (!(priceLp > 0)) return { ok: false, error: 'Prezzo non disponibile' };
  const value = r2(pos.units * priceLp);
  const amt = amountLp === 'all' ? value : r2(amountLp);
  if (!(amt >= MIN_ORDER_LP) && amountLp !== 'all') return { ok: false, error: `Importo minimo ${MIN_ORDER_LP} LP` };
  if (amt > value + 0.005) return { ok: false, error: 'Vuoi vendere più di quanto vale la posizione' };
  const closing = amountLp === 'all' || amt >= value - 0.005;
  const units = closing ? pos.units : r6(amt / priceLp);
  const out = closing ? value : amt;
  const left = r6(pos.units - units);
  const keep = closing || left <= 0 ? 0 : pos.costLp * (left / pos.units);
  return { ok: true, units, amountLp: out, position: left > 0 ? { sym: pos.sym, units: left, costLp: r2(keep) } : null };
}
export const valueLp = (pos: Position, priceLp: number) => r2(pos.units * priceLp);
export function pnl(pos: Position, priceLp: number) {
  const value = valueLp(pos, priceLp), gain = r2(value - pos.costLp);
  return { value, gain, pct: pos.costLp > 0 ? (gain / pos.costLp) * 100 : 0 };
}
export function portfolio(positions: Position[], priceOf: (sym: string) => number) {
  const rows = positions.map((p) => ({ ...p, ...pnl(p, priceOf(p.sym)) }));
  const value = r2(rows.reduce((s, x) => s + x.value, 0)), cost = r2(rows.reduce((s, x) => s + x.costLp, 0));
  return { rows, value, cost, gain: r2(value - cost), pct: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
}
