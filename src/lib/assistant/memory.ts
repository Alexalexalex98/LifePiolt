/**
 * Memoria compatta di Theia: quando una conversazione si chiude, i messaggi diventano poche righe per argomento
 * (cosa ha detto l'utente, cosa ha risposto Theia in breve). Col tempo le righe si fondono in riassunti mensili e poi annuali,
 * così il contesto resta piccolo ma Theia ricorda anche cose di mesi o di un anno fa. Tutto si calcola sul telefono.
 */
import { similarity } from './nlp.ts';

export type Msg = { who: 'me' | 'ai'; text: string; ts: number; topic: string };
/** `kind`: s = una conversazione, m = un mese, y = un anno */
export type Memo = { id: string; topic: string; kind: 's' | 'm' | 'y'; from: number; to: number; n: number; text: string };

const DAY = 86400000;
const clip = (s: string, n: number) => { const x = s.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1).trimEnd()}…` : x; };
const firstSentence = (s: string) => clip((s.split(/(?<=[.!?])\s/)[0] ?? s), 110);
const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/** Riduce i messaggi di una conversazione (già dello stesso argomento) a poche righe: le cose dette dall'utente e, in breve, cosa ha risposto Theia. */
export function compactMessages(msgs: Msg[], maxChars = 640): string {
  const lines: string[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.who !== 'me' || m.text.trim().length < 6) continue;
    const next = msgs[i + 1];
    const ans = next && next.who === 'ai' && next.text.trim() ? ` → ${firstSentence(next.text)}` : '';
    lines.push(`${clip(m.text, 150)}${ans}`);
  }
  let out = '';
  for (const l of lines) { if ((out + l).length + 3 > maxChars) break; out += `${out ? ' | ' : ''}${l}`; }
  return out;
}

/** Chiude le conversazioni passate: un ricordo per ogni argomento toccato dai messaggi con ts > `after`. */
export function closeSession(log: Msg[], after: number, idOf: () => string): Memo[] {
  const fresh = log.filter((m) => m.ts > after && m.text.trim());
  const byTopic = new Map<string, Msg[]>();
  fresh.forEach((m) => byTopic.set(m.topic, [...(byTopic.get(m.topic) ?? []), m]));
  const out: Memo[] = [];
  byTopic.forEach((ms, topic) => {
    const text = compactMessages(ms);
    if (text) out.push({ id: idOf(), topic, kind: 's', from: ms[0]!.ts, to: ms[ms.length - 1]!.ts, n: ms.length, text });
  });
  return out;
}

const monthKey = (ts: number) => new Date(ts).toISOString().slice(0, 7);
const yearKey = (ts: number) => new Date(ts).toISOString().slice(0, 4);

function fuse(group: Memo[], kind: 'm' | 'y', cap: number): Memo {
  const sorted = [...group].sort((a, b) => a.from - b.from);
  let text = '';
  /* se non c'è posto tengo le righe più recenti del gruppo, ma lascio sempre traccia delle prime */
  const parts = sorted.map((g) => g.text);
  const joined = parts.join(' | ');
  if (joined.length <= cap) text = joined;
  else {
    const per = Math.max(60, Math.floor((cap - 4) / parts.length));
    text = parts.map((p) => clip(p, per)).join(' | ');
    if (text.length > cap) text = clip(text, cap);
  }
  return { id: sorted[0]!.id, topic: sorted[0]!.topic, kind, from: sorted[0]!.from, to: sorted[sorted.length - 1]!.to, n: sorted.reduce((a, g) => a + g.n, 0), text };
}

/** Più passa il tempo più i ricordi si fondono: oltre 30 giorni diventano un riassunto del mese, oltre un anno un riassunto dell'anno. */
export function consolidate(memos: Memo[], now = Date.now()): Memo[] {
  const keep: Memo[] = [];
  const months = new Map<string, Memo[]>();
  const years = new Map<string, Memo[]>();
  for (const m of memos) {
    const age = now - m.to;
    if (age > 365 * DAY) { const k = `${m.topic}|${yearKey(m.to)}`; years.set(k, [...(years.get(k) ?? []), m]); }
    else if (age > 30 * DAY) { const k = `${m.topic}|${monthKey(m.to)}`; months.set(k, [...(months.get(k) ?? []), m]); }
    else keep.push(m);
  }
  months.forEach((g) => keep.push(g.length === 1 && g[0]!.kind !== 's' ? g[0]! : fuse(g, 'm', 900)));
  years.forEach((g) => keep.push(g.length === 1 && g[0]!.kind === 'y' ? g[0]! : fuse(g, 'y', 1100)));
  return keep.sort((a, b) => a.to - b.to);
}

/**
 * Cosa mettere nel prompt: i ricordi più pertinenti alla domanda e quelli più recenti, dal più vecchio al più nuovo, entro `budget` caratteri.
 * Un ricordo è citato con la sua data, così Theia sa quanto è vecchio.
 */
export function memoryFor(memos: Memo[], question: string, budget = 2600, now = Date.now(), skipAfter = Infinity): string {
  const pool = memos.filter((m) => m.to < skipAfter);
  if (!pool.length) return '';
  const scored = pool.map((m) => ({ m, s: similarity(question, m.text) + (now - m.to < 14 * DAY ? 0.15 : 0) })).sort((a, b) => b.s - a.s || b.m.to - a.m.to);
  const picked: Memo[] = [];
  let used = 0;
  for (const { m, s } of scored) {
    if (picked.length >= 4 && s < 0.2) break; // dopo i primi, solo quelli che c'entrano davvero
    const cost = m.text.length + 40;
    if (used + cost > budget) continue;
    picked.push(m); used += cost;
  }
  return picked.sort((a, b) => a.to - b.to).map((m) => {
    const span = m.kind === 's' ? day(m.to) : m.kind === 'm' ? monthKey(m.to) : yearKey(m.to);
    return `[${span} · ${m.topic}] ${m.text}`;
  }).join('\n');
}
