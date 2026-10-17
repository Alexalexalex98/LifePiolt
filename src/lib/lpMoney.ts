/**
 * Il «conto» di una persona è il suo saldo in LifePoints. Qui la logica pura per leggerlo come un'app di banca:
 * spese per categoria e confronto col mese scorso, budget, obiettivi, ricorrenze, divisione di un conto.
 */
import type { LpMove } from './lpStatement.ts';

export const CATEGORIES = ['Seminari e servizi', 'Idee', 'Acquisti', 'Pagamenti', 'Fitness', 'Investimenti', 'Promozioni', 'Altro'] as const;
export type Category = (typeof CATEGORIES)[number];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** In che categoria cade una spesa, dal collegamento o dalla descrizione. */
export function categoryOf(m: Pick<LpMove, 'label' | 'ref'>): Category {
  const ref = m.ref ?? '', l = m.label.toLowerCase();
  if (ref.startsWith('enr:') || /^(seminario|sessione)\b/.test(l)) return 'Seminari e servizi';
  if (ref.startsWith('idea:') || l.startsWith('contributo a')) return 'Idee';
  if (ref.startsWith('ord:') || l.startsWith('acquisto:')) return 'Acquisti';
  if (ref.startsWith('pay:') || l.startsWith('pagamento a')) return 'Pagamenti';
  if (l.includes('lifefitness') || l.includes('lifepass') || l.includes('palestra')) return 'Fitness';
  if (/^(acquisto|vendita) [a-z.-]{1,6}$/i.test(m.label)) return 'Investimenti';
  if (l.startsWith('promozione')) return 'Promozioni';
  return 'Altro';
}
export const monthStart = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
export const prevMonthStart = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); };

export type CatRow = { cat: Category; now: number; before: number; /** variazione sul mese scorso in %, null se prima era 0 */ delta: number | null };
/** Spese del mese di `at` per categoria, con il mese prima accanto. Gli acquisti di titoli non sono spese: si vedono negli investimenti. */
export function spendByCategory(moves: LpMove[], at: number): { rows: CatRow[]; total: number; totalBefore: number } {
  const a = monthStart(at), p = prevMonthStart(at), nextA = new Date(new Date(a).getFullYear(), new Date(a).getMonth() + 1, 1).getTime();
  const now: Record<string, number> = {}, before: Record<string, number> = {};
  for (const m of moves) {
    if (m.kind !== 'spend') continue;
    const c = categoryOf(m);
    if (c === 'Investimenti') continue;
    if (m.ts >= a && m.ts < nextA) now[c] = (now[c] ?? 0) + m.amount;
    else if (m.ts >= p && m.ts < a) before[c] = (before[c] ?? 0) + m.amount;
  }
  const rows = CATEGORIES.filter((c) => now[c] || before[c]).map((cat) => ({ cat, now: r2(now[cat] ?? 0), before: r2(before[cat] ?? 0), delta: before[cat] ? ((((now[cat] ?? 0) - before[cat]) / before[cat]) * 100) : null }));
  rows.sort((x, y) => y.now - x.now);
  return { rows, total: r2(rows.reduce((s, x) => s + x.now, 0)), totalBefore: r2(rows.reduce((s, x) => s + x.before, 0)) };
}

/* ---------- budget ---------- */
export type BudgetLevel = 'ok' | 'warn' | 'over';
export function budgetStatus(spent: number, limit: number): { pct: number; left: number; level: BudgetLevel } {
  if (!(limit > 0)) return { pct: 0, left: 0, level: 'ok' };
  const pct = (spent / limit) * 100;
  return { pct, left: r2(limit - spent), level: pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok' };
}

/* ---------- obiettivi ---------- */
export type Goal = { id: string; name: string; target: number; saved: number; createdAt: number };
export const goalPct = (g: Goal) => (g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0);
/** Aggiunge (o toglie, con importo negativo) LP a un obiettivo, senza uscire da 0..target. */
export function addToGoal(g: Goal, amount: number): Goal { return { ...g, saved: r2(Math.max(0, Math.min(g.target, g.saved + amount))) }; }
/** Arrotondamento: quanto manca per arrivare all'intero superiore (0 se già intero). */
export function roundUpOf(amount: number): number { const up = Math.ceil(amount - 1e-9); return r2(up - amount > 0.0049 ? up - amount : 0); }

/* ---------- ricorrenze ---------- */
export type Recurring = { label: string; amount: number; times: number; last: number; /** prossimo addebito stimato */ next: number };
/** Spese che tornano: stessa descrizione e stesso importo in almeno due mesi diversi. */
export function detectRecurring(moves: LpMove[]): Recurring[] {
  const by = new Map<string, LpMove[]>();
  for (const m of moves) if (m.kind === 'spend' && categoryOf(m) !== 'Investimenti') { const k = `${m.label.replace(/\s*\(rinnovo\)/i, '')}|${m.amount}`; by.set(k, [...(by.get(k) ?? []), m]); }
  const out: Recurring[] = [];
  for (const [k, xs] of by) {
    const months = new Set(xs.map((x) => monthStart(x.ts)));
    if (months.size < 2) continue;
    const last = Math.max(...xs.map((x) => x.ts));
    const d = new Date(last);
    out.push({ label: k.split('|')[0], amount: xs[0].amount, times: xs.length, last, next: new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()).getTime() });
  }
  return out.sort((a, b) => a.next - b.next);
}

/* ---------- dividere un conto ---------- */
/** Parti uguali tra `people` (chi ha pagato compreso): i centesimi avanzati vanno alle prime quote. */
export function splitEqual(total: number, people: number): number[] {
  if (!(total > 0) || people < 1) return [];
  const cents = Math.round(total * 100), base = Math.floor(cents / people), extra = cents - base * people;
  return Array.from({ length: people }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}
