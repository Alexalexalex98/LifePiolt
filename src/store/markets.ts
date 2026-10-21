import { create } from 'zustand';

import { BY_SYM, CATALOG } from '@/lib/markets/catalog';
import type { Facts } from '@/lib/markets/fundamentals';
import { buy as doBuy, sell as doSell, type Order, type Position } from '@/lib/markets/invest';
import { FALLBACK_USDCHF, chunk, feedCode, parseHistoryCsv, parseQuotesCsv, simulatedHistory, simulatedPrice, usdToLp, type Quote } from '@/lib/markets/quotes';
import { useNet } from './network';
import { httpGetText } from '@/lib/http';
import { persisted } from './persist';

const BASE = 'https://stooq.com';
const STALE_MS = 60_000;
const memHistory = new Map<string, { at: number; closes: number[] }>();

type MarketsState = {
  quotes: Record<string, Quote>;
  /** chiusura del giorno prima di ogni titolo: serve alla variazione di oggi */
  closes: Record<string, { date: string; close: number; prev?: number }>;
  usdChf: number;
  updatedAt: number;
  /** i prezzi vengono dalla fonte dati (true) o sono dimostrativi (false) */
  live: boolean;
  positions: Record<string, Position>;
  orders: Order[];
  watch: string[];
  /** dati societari scritti a mano dall'utente (utili, dividendo...): la fonte dei prezzi non li dà */
  facts: Record<string, Facts>;
  setFact: (sym: string, f: Facts) => void;
  clearFacts: (sym: string) => void;
  refreshing: boolean;
  refresh: (force?: boolean) => Promise<void>;
  toggleWatch: (sym: string) => void;
  buy: (sym: string, amountLp: number) => { ok: boolean; error?: string };
  sell: (sym: string, amountLp: number | 'all') => { ok: boolean; error?: string };
  reset: () => void;
};

const get = (url: string): Promise<string> => httpGetText(url, 9000);

export const useMarkets = create<MarketsState>()(persisted<MarketsState>('markets', (set, get_) => ({
  quotes: {}, closes: {}, usdChf: FALLBACK_USDCHF, updatedAt: 0, live: false, positions: {}, orders: [], watch: ['AAPL', 'NVDA', 'GLD', 'SPY'], facts: {}, setFact: (sym, f) => set((s) => ({ facts: { ...s.facts, [sym]: { ...s.facts[sym], ...f } } })),
  clearFacts: (sym) => set((s) => { const facts = { ...s.facts }; delete facts[sym]; return { facts }; }), refreshing: false,
  refresh: async (force) => {
    const s = get_();
    if (s.refreshing || (!force && Date.now() - s.updatedAt < STALE_MS)) return;
    set({ refreshing: true });
    try {
      const got: Record<string, Quote> = {};
      for (const part of chunk(CATALOG.map((i) => feedCode(i.sym)), 45)) {
        const txt = await get(`${BASE}/q/l/?s=${part.join('+')}&f=sd2t2ohlcv&h&e=csv`);
        Object.assign(got, parseQuotesCsv(txt));
      }
      const fx = parseQuotesCsv(await get(`${BASE}/q/l/?s=usdchf&f=sd2t2ohlcv&h&e=csv`)).USDCHF;
      if (!Object.keys(got).length) throw new Error('nessun prezzo');
      const closes = { ...s.closes };
      for (const [sym, q] of Object.entries(got)) {
        const old = closes[sym];
        const prev = !old ? undefined : old.date === q.date ? old.prev : old.close;
        if (prev) q.prev = prev;
        closes[sym] = { date: q.date, close: q.price, ...(prev ? { prev } : {}) };
      }
      set({ quotes: { ...s.quotes, ...got }, closes, usdChf: fx?.price ?? s.usdChf, updatedAt: Date.now(), live: true, refreshing: false });
    } catch {
      // senza rete restano gli ultimi prezzi noti o quelli dimostrativi
      set({ updatedAt: Date.now(), refreshing: false, live: Object.keys(get_().quotes).length > 0 && get_().live });
    }
  },
  toggleWatch: (sym) => set((s) => ({ watch: s.watch.includes(sym) ? s.watch.filter((x) => x !== sym) : [...s.watch, sym] })),
  buy: (sym, amountLp) => {
    const s = get_();
    const price = priceLp(s, sym);
    const net = useNet.getState();
    const r = doBuy(s.positions[sym], sym, amountLp, price, net.lifePoints);
    if (!r.ok) return { ok: false, error: r.error };
    if (!net.spend(r.amountLp, `Acquisto ${sym}`)) return { ok: false, error: 'Saldo LifePoints insufficiente' };
    set({ positions: { ...s.positions, [sym]: r.position! }, orders: [{ id: `o${Date.now().toString(36)}`, sym, side: 'buy' as const, units: r.units, priceLp: price, amountLp: r.amountLp, ts: Date.now() }, ...s.orders].slice(0, 500) });
    return { ok: true };
  },
  sell: (sym, amountLp) => {
    const s = get_();
    const price = priceLp(s, sym);
    const r = doSell(s.positions[sym], amountLp, price);
    if (!r.ok) return { ok: false, error: r.error };
    useNet.getState().earn(r.amountLp, `Vendita ${sym}`);
    const positions = { ...s.positions };
    if (r.position) positions[sym] = r.position; else delete positions[sym];
    set({ positions, orders: [{ id: `o${Date.now().toString(36)}`, sym, side: 'sell' as const, units: r.units, priceLp: price, amountLp: r.amountLp, ts: Date.now() }, ...s.orders].slice(0, 500) });
    return { ok: true };
  },
  reset: () => set({ positions: {}, orders: [], watch: ['AAPL', 'NVDA', 'GLD', 'SPY'] }),
}), (s) => ({ quotes: s.quotes, closes: s.closes, usdChf: s.usdChf, updatedAt: s.updatedAt, live: s.live, positions: s.positions, orders: s.orders, watch: s.watch, facts: s.facts } as Partial<MarketsState>)));

/** Prezzo in dollari: quello della fonte dati se c'è, altrimenti dimostrativo. */
export function priceUsd(s: Pick<MarketsState, 'quotes'>, sym: string, now = Date.now()): number {
  const q = s.quotes[sym];
  if (q) return q.price;
  const i = BY_SYM[sym];
  return i ? simulatedPrice(sym, i.last, now) : 0;
}
export const priceLp = (s: Pick<MarketsState, 'quotes' | 'usdChf'>, sym: string) => usdToLp(priceUsd(s, sym), s.usdChf);
/** Variazione di oggi in percentuale. Senza dati veri è dimostrativa e coerente col prezzo. */
export function dayChangePct(s: Pick<MarketsState, 'quotes'>, sym: string): number {
  const q = s.quotes[sym];
  if (q) { const base = q.prev ?? q.open; return base > 0 ? ((q.price - base) / base) * 100 : 0; }
  const i = BY_SYM[sym];
  if (!i) return 0;
  const now = Date.now();
  const p = simulatedPrice(sym, i.last, now), d = simulatedPrice(sym, i.last, now - 86_400_000);
  return d > 0 ? ((p - d) / d) * 100 : 0;
}
/** Storico dei prezzi in dollari (si scarica una volta, poi resta in memoria; senza rete è dimostrativo). */
export async function loadHistory(sym: string, currentUsd: number): Promise<{ closes: number[]; live: boolean }> {
  const hit = memHistory.get(sym);
  if (hit && Date.now() - hit.at < 3_600_000) return { closes: hit.closes, live: true };
  try {
    const closes = parseHistoryCsv(await get(`${BASE}/q/d/l/?s=${feedCode(sym)}&i=d`)).slice(-1300);
    if (closes.length > 10) { memHistory.set(sym, { at: Date.now(), closes }); return { closes, live: true }; }
  } catch { /* si passa al dimostrativo */ }
  return { closes: simulatedHistory(sym, currentUsd), live: false };
}

/** Il nostro server dei dati di bilancio (non ancora collegato): `GET {EXPO_PUBLIC_FUNDAMENTALS_URL}/fundamentals/{simbolo}` -> { eps, bvps, ... } come in `Facts`. */
export const fundamentalsConfigured = Boolean(process.env.EXPO_PUBLIC_FUNDAMENTALS_URL);
export async function fetchFacts(sym: string): Promise<Facts | null> {
  const base = process.env.EXPO_PUBLIC_FUNDAMENTALS_URL;
  if (!base) return null;
  try { const j = JSON.parse(await get(`${base}/fundamentals/${encodeURIComponent(sym)}`)) as Record<string, unknown>; const out: Facts = {}; for (const [k, v] of Object.entries(j)) if (typeof v === 'number' && Number.isFinite(v)) (out as Record<string, number>)[k] = v; return Object.keys(out).length ? out : null; } catch { return null; }
}
