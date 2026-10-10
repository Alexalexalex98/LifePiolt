import plansJson from './plans.json' with { type: 'json' };
import { tx } from './tx.ts';
import type { TaskKind } from './types.ts';

/** Limiti e costi: per compito, a finestre (giorno locale o finestra mobile) e con budget di costo stimato. Funzioni pure. */
export type LimitWindow = 'day' | 'rolling';
export type Limit = { id: string; scope: TaskKind[] | 'tokens'; window: LimitWindow; hours?: number; max: number; unit: string };
export type Plan = { id: string; label: string; example: boolean; limits: Limit[]; budget: { day: number; month: number } };
export type UsageEntry = { ts: number; kind: TaskKind; units: number; tokens: number; cost: number };
export type PlanId = 'free' | 'plus' | 'pro';

type PlansFile = { plans: Record<string, { label: string; example?: boolean; limits: Limit[]; budget: { day: number; month: number } }> };
const raw = plansJson as unknown as PlansFile;
export const PLANS: Plan[] = (Object.keys(raw.plans) as string[]).map((id) => ({ id, label: raw.plans[id].label, example: !!raw.plans[id].example, limits: raw.plans[id].limits, budget: raw.plans[id].budget }));
export const planById = (id: string): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];

/** Compiti che consumano token (testo). */
export const TOKEN_KINDS: TaskKind[] = ['chat', 'reasoning', 'vision_read', 'document_create', 'agent_task', 'web_search', 'translate', 'summarize'];

const HOUR = 3600000, DAY = 86400000;

/** Offset del fuso in minuti a est di UTC (come -getTimezoneOffset). */
export const localOffsetMin = (now: number): number => -new Date(now).getTimezoneOffset();

export const startOfLocalDay = (ts: number, offMin: number): number => Math.floor((ts + offMin * 60000) / DAY) * DAY - offMin * 60000;
export const startOfLocalMonth = (ts: number, offMin: number): number => {
  const d = new Date(ts + offMin * 60000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - offMin * 60000;
};
const startOfNextLocalMonth = (ts: number, offMin: number): number => {
  const d = new Date(ts + offMin * 60000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - offMin * 60000;
};

/** Stima dei token dal testo. SOLO una stima: CJK ~0,7 token per carattere, alfabeti non latini ~1 ogni 2,5, latino ~1 ogni 4. */
export function estimateTokens(text: string): number {
  let latin = 0, cjk = 0, other = 0;
  for (const ch of text ?? '') {
    if (/\s/.test(ch)) { latin += 0.25; continue; }
    if (/[぀-ヿ㐀-鿿가-힯]/.test(ch)) cjk++;
    else if (/[\u0000-ɏ]/.test(ch)) latin++;
    else other++;
  }
  return Math.ceil(latin / 4 + cjk * 0.7 + other / 2.5);
}

/** Token attesi di una richiesta (ingresso + uscita tipica). */
export const OUTPUT_TOKENS: Partial<Record<TaskKind, number>> = { chat: 500, reasoning: 1500, vision_read: 500, document_create: 2000, agent_task: 4000, web_search: 800, translate: 0, summarize: 400 };
export function estimateRequestTokens(kind: TaskKind, text: string): number {
  if (!TOKEN_KINDS.includes(kind)) return 0;
  const inT = estimateTokens(text);
  return inT + (kind === 'translate' ? inT : OUTPUT_TOKENS[kind] ?? 500);
}

export type Need = { kind: TaskKind; tokens?: number; cost?: number };
export type Denied = { ok: false; limit: Limit | { id: string; unit: string; max: number; window: 'budget_day' | 'budget_month' }; used: number; max: number; resetAt: number; reason: string };
export type SpendCheck = { ok: true } | Denied;

const fmtTime = (ts: number, off: number) => { const d = new Date(ts + off * 60000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const num = (n: number) => Math.round(n).toLocaleString('it-IT');

function usedIn(log: UsageEntry[], limit: Limit, now: number, off: number): { used: number; entries: { ts: number; amt: number }[]; windowStart: number } {
  const windowStart = limit.window === 'day' ? startOfLocalDay(now, off) : now - (limit.hours ?? 1) * HOUR;
  const entries: { ts: number; amt: number }[] = [];
  for (const e of log) {
    if (limit.scope === 'tokens' ? !TOKEN_KINDS.includes(e.kind) : !limit.scope.includes(e.kind)) continue;
    // finestra mobile: (now - ore, now]; un uso di esattamente N ore fa e' gia' fuori. Giorno: da mezzanotte locale.
    const inside = limit.window === 'day' ? e.ts >= windowStart && e.ts <= now : e.ts > windowStart && e.ts <= now;
    if (!inside) continue;
    entries.push({ ts: e.ts, amt: limit.scope === 'tokens' ? e.tokens : e.units });
  }
  entries.sort((a, b) => a.ts - b.ts);
  return { used: entries.reduce((a, e) => a + e.amt, 0), entries, windowStart };
}

/** Quando si libera abbastanza spazio per `amt` in una finestra mobile. */
function rollingReset(entries: { ts: number; amt: number }[], used: number, max: number, amt: number, hours: number): number {
  let u = used;
  for (const e of entries) { u -= e.amt; if (u + amt <= max) return e.ts + hours * HOUR; }
  return (entries[entries.length - 1]?.ts ?? 0) + hours * HOUR;
}

/** Puo' spendere? Controlla i limiti del piano per quel compito e i budget di costo (giorno e mese). Non registra nulla. */
export function canSpend(log: UsageEntry[], plan: Plan, need: Need, now: number, offMin: number = localOffsetMin(now)): SpendCheck {
  for (const limit of plan.limits) {
    const isTok = limit.scope === 'tokens';
    if (isTok ? !TOKEN_KINDS.includes(need.kind) : !limit.scope.includes(need.kind)) continue;
    const amt = isTok ? need.tokens ?? 0 : 1;
    if (amt <= 0) continue;
    const { used, entries } = usedIn(log, limit, now, offMin);
    if (used + amt <= limit.max) continue;
    const resetAt = limit.window === 'day' ? startOfLocalDay(now, offMin) + DAY : rollingReset(entries, used, limit.max, amt, limit.hours ?? 1);
    let reason: string;
    if (limit.window === 'day') {
      reason = tx('Hai usato {0} {1} su {2} oggi. Si azzera domani alle 00:00.', num(used), limit.unit, num(limit.max));
    } else {
      reason = tx('Hai usato {0} {1} su {2} nelle ultime {3} ore. Si libera spazio alle {4}.', num(used), limit.unit, num(limit.max), limit.hours ?? 1, fmtTime(resetAt, offMin));
    }
    return { ok: false, limit, used, max: limit.max, resetAt, reason };
  }
  const cost = need.cost ?? 0;
  if (cost > 0) {
    const dayStart = startOfLocalDay(now, offMin), monthStart = startOfLocalMonth(now, offMin);
    const dayUsed = sumCost(log, dayStart, now), monthUsed = sumCost(log, monthStart, now);
    if (dayUsed + cost > plan.budget.day) {
      return { ok: false, limit: { id: 'budget_day', unit: 'unità di costo', max: plan.budget.day, window: 'budget_day' }, used: dayUsed, max: plan.budget.day, resetAt: dayStart + DAY, reason: tx('Il budget stimato di oggi è finito. Si azzera domani alle 00:00.') };
    }
    if (monthUsed + cost > plan.budget.month) {
      return { ok: false, limit: { id: 'budget_month', unit: 'unità di costo', max: plan.budget.month, window: 'budget_month' }, used: monthUsed, max: plan.budget.month, resetAt: startOfNextLocalMonth(now, offMin), reason: tx('Il budget stimato del mese è finito. Si azzera il primo del mese prossimo.') };
    }
  }
  return { ok: true };
}
const sumCost = (log: UsageEntry[], from: number, to: number) => log.reduce((a, e) => (e.ts >= from && e.ts <= to ? a + e.cost : a), 0);

const KEEP_DAYS = 40;
/** Registra un uso e scarta quelli troppo vecchi. */
export function record(log: UsageEntry[], entry: UsageEntry, now: number = entry.ts): UsageEntry[] {
  return [...log.filter((e) => e.ts > now - KEEP_DAYS * DAY), entry];
}

export type Bar = { id: string; label: string; used: number; max: number; unit: string; windowLabel: string; resetAt: number | null; resetText: string };

const LIMIT_LABEL: Record<string, string> = { songs_day: 'Canzoni', images_day: 'Immagini', docs_day: 'Documenti', agents_day: 'Richieste agenti', tokens_5h: 'Token (stima)' };

/** Barre d'uso per la schermata: quanto resta per ogni limite del piano. */
export function usageBars(log: UsageEntry[], plan: Plan, now: number, offMin: number = localOffsetMin(now)): Bar[] {
  return plan.limits.map((limit) => {
    const { used, entries } = usedIn(log, limit, now, offMin);
    const label = LIMIT_LABEL[limit.id] ?? limit.unit;
    const windowLabel = limit.window === 'day' ? tx('oggi') : tx('ultime {0} ore', limit.hours ?? 1);
    let resetAt: number | null = null, resetText = '';
    if (limit.window === 'day') { resetAt = startOfLocalDay(now, offMin) + DAY; resetText = tx('Si azzera domani alle 00:00'); }
    else if (entries.length) { resetAt = entries[0].ts + (limit.hours ?? 1) * HOUR; resetText = tx('Si libera spazio alle {0}', fmtTime(resetAt, offMin)); }
    else resetText = tx('Nessun uso nella finestra');
    return { id: limit.id, label, used, max: limit.max, unit: limit.unit, windowLabel, resetAt, resetText };
  });
}

export function costTotals(log: UsageEntry[], now: number, offMin: number = localOffsetMin(now)): { day: number; month: number } {
  return { day: sumCost(log, startOfLocalDay(now, offMin), now), month: sumCost(log, startOfLocalMonth(now, offMin), now) };
}
