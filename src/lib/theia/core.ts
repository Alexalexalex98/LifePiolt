/**
 * Theia: fatti, formati e verifica dei numeri (modulo PURO).
 * Regola: ogni numero che Theia scrive viene da un dato dell'utente o da un calcolo. Un testo che contiene un numero senza origine non si mostra.
 */
import type { Shift } from '../shifts.ts';

export type Ev = { time: string; title: string; dur?: number };
export type Task = { id: string; t: string; done?: boolean; due?: string; urgent?: boolean };
export type Snap = {
  now: number;
  events: Record<string, Ev[]>;
  shifts: Shift[];
  tasks: Task[];
  /** null = non ci sono dati finanziari */
  finance: null | { partial: boolean; day: number; daysInMonth: number; income: number; expense: number; saved: number; end: number; projectionEnd: number | null; over: { category: string; pct: number; level: string }[]; topCats: { n: string; v: number }[];
    /** mese precedente (se c'è) e come sono cambiate le categorie rispetto a quel mese */
    prev?: { label: string; income: number; expense: number } | null; deltas?: { n: string; v: number; prev: number }[]; label?: string };
  /** dall'estratto conto: entrate che tornano (uno o più stipendi), spese fisse e variabili medie al mese, e l'obiettivo vacanza salvato */
  savings?: null | { incomes: { name: string; monthly: number }[]; fixed: number; variable: number; vacation?: { name: string; goal: number; target: string; saved: number } | null };
  /** notti più recenti, in ore */
  sleep: { day: string; hours: number }[];
  steps: { day: string; v: number }[];
  water: { todayMl: number; goalMl: number } | null;
  kcal: { today: number; target: number | null } | null;
  currency: string;
};

export type Fact = { label: string; value: number | string; unit?: string; source: string };
export type Answer = { text: string; facts: Fact[]; sources: string[] };

/** 1234.5 -> «1.234,5»; interi senza decimali. */
export function fmtNum(n: number, dec?: number): string {
  const d = dec ?? (Number.isInteger(n) ? 0 : Math.abs(n) < 10 ? 1 : 0);
  const fixed = Math.abs(n).toFixed(d);
  const [i, f] = fixed.split('.');
  const withDots = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}${withDots}${f ? ',' + f : ''}`;
}
export const fmtMoney = (n: number, cur: string) => `${fmtNum(Math.round(n), 0)} ${cur}`;

/** I numeri (e gli orari) scritti in un testo. «1.234,5», «12,5», «06:00», «30». */
export function numbersIn(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)*(?::\d{2})?/g) ?? [];
}
const canon = (tok: string) => tok.replace(/\./g, '').replace(',', '.');

/** Quali numeri del testo non vengono dai fatti? Vuoto = tutto verificato. Si confrontano i valori (1.234 = 1234), non solo la scrittura. */
export function unverifiedNumbers(text: string, facts: Fact[], extraAllowed: (number | string)[] = []): string[] {
  const allowed = new Set<string>();
  const add = (v: number | string) => {
    if (typeof v === 'number') { allowed.add(String(Math.round(v * 100) / 100)); allowed.add(String(Math.round(v))); allowed.add(String(Math.abs(Math.round(v)))); allowed.add(String(Math.abs(Math.round(v * 10) / 10))); allowed.add(String(Math.abs(Math.round(v * 100) / 100))); }
    else for (const tk of numbersIn(v)) { allowed.add(tk); allowed.add(String(Number(canon(tk)))); }
  };
  facts.forEach((f) => add(f.value));
  extraAllowed.forEach(add);
  // le date scritte per esteso (2026-10-20) valgono come un solo dato: devono essere nei fatti
  const fact = facts.map((f) => String(f.value)).join(' ');
  const clean = text.replace(/\d{4}-\d{2}-\d{2}/g, (d) => (fact.includes(d) ? ' ' : d));
  return numbersIn(clean).filter((tk) => {
    if (allowed.has(tk)) return false;
    if (tk.includes(':')) return !allowed.has(tk);
    const v = String(Number(canon(tk)));
    return !allowed.has(v);
  });
}

export const verified = (a: Answer, extra: (number | string)[] = []) => unverifiedNumbers(a.text, a.facts, extra).length === 0;

export const dayKeyOf = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** «oggi», «ieri» o «20 ott» (per i testi che citano un giorno). */
export function humanDay(key: string, todayKey: string): string {
  if (key === todayKey) return 'oggi';
  const [y, m, d] = key.split('-').map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(todayKey.slice(0, 4) as unknown as number, Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8))).getTime()) / 86400000);
  if (diff === -1) return 'ieri';
  const MON = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${d} ${MON[m - 1]}`;
}
export const addDay = (key: string, n: number) => { const [y, m, d] = key.split('-').map(Number); return dayKeyOf(new Date(y, m - 1, d + n).getTime()); };
export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
export const hhmm = (min: number) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
