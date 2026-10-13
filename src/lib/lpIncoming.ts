/**
 * LifePoints in arrivo (modulo PURO): donazioni e pagamenti che altri fanno a te. Contano subito sul profilo e sul conto anche se sono
 * ancora bloccati (fino alla fine dell'evento); se poi non vengono accreditati (annullamento, rimborso) vengono tolti.
 */
export type IncomingSource = 'giornaliero' | 'iscrizioni' | 'pagamenti' | 'idee' | 'altro';
export type Incoming = {
  id: string; ts: number; from: string; label: string; amount: number; source: IncomingSource;
  /** quando si sblocca: senza, è accreditato subito */ releaseAt?: number;
  status: 'pending' | 'credited' | 'reversed'; ref?: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function makeIncoming(a: { id: string; now: number; from: string; label: string; amount: number; source: IncomingSource; releaseAt?: number; ref?: string }): Incoming | null {
  const amount = r2(a.amount);
  if (!(amount > 0) || !a.from.trim()) return null;
  const held = a.releaseAt != null && a.releaseAt > a.now;
  return { id: a.id, ts: a.now, from: a.from, label: a.label, amount, source: a.source, ...(held ? { releaseAt: a.releaseAt } : {}), status: held ? 'pending' : 'credited', ...(a.ref ? { ref: a.ref } : {}) };
}
/** Totale ancora bloccato (conta sul profilo e sul conto come «in arrivo»). */
export const pendingTotal = (list: Incoming[] | undefined): number => r2((list ?? []).filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0));
/** Quelli bloccati la cui ora è arrivata: vanno accreditati. */
export const dueIncoming = (list: Incoming[] | undefined, now: number): Incoming[] => (list ?? []).filter((i) => i.status === 'pending' && i.releaseAt != null && now >= i.releaseAt);
export function markCredited(list: Incoming[], ids: string[]): Incoming[] { const s = new Set(ids); return list.map((i) => (s.has(i.id) && i.status === 'pending' ? { ...i, status: 'credited' as const } : i)); }
/** Annulla un arrivo: se era già accreditato va tolto dal conto (`deduct`), se era ancora bloccato sparisce soltanto. */
export function reverseIncoming(list: Incoming[], id: string): { list: Incoming[]; deduct: number; found: Incoming | null } {
  const found = list.find((i) => i.id === id && i.status !== 'reversed') ?? null;
  if (!found) return { list, deduct: 0, found: null };
  return { list: list.map((i) => (i.id === id ? { ...i, status: 'reversed' as const } : i)), deduct: found.status === 'credited' ? found.amount : 0, found };
}
/** Quanto ho in tutto: disponibili + in arrivo. */
export const totalWithPending = (available: number, list: Incoming[] | undefined): number => r2(available + pendingTotal(list));
