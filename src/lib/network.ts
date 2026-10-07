import { hashStr, mulberry32, shortDate } from '@/lib/format';
import { totalUnread, useChat } from '@/store/chat';
import { useNet, type Idea } from '@/store/network';

/* ---------- punteggio idea ---------- */
export function rateIdeaDetailed(text: string) {
  const low = text.toLowerCase();
  let score = 50;
  const parts: { label: string; pts: number }[] = [{ label: 'Punteggio base', pts: 50 }];
  const add = (cond: boolean, pts: number, label: string) => { if (cond) { score += pts; parts.push({ label, pts }); } };
  add(text.length > 80, 8, 'Descrizione con dettagli sufficienti');
  add(text.length > 200, 8, 'Descrizione approfondita (oltre 200 caratteri)');
  add(/mercato|clienti|utenti|problema/.test(low), 8, 'Definisce chiaramente il problema e il mercato');
  add(/ricavi|prezzo|modello di business|abbonamento/.test(low), 8, 'Ha un modello di ricavi chiaro');
  add(/concorrenza|competitor/.test(low), 6, "Analizza la concorrenza esistente");
  add(/team|squadra/.test(low), 4, 'Menziona un team già al lavoro');
  const jitter = Math.round(mulberry32(hashStr(text))() * 10) - 5;
  parts.push({ label: 'Variazione di calibrazione del modello', pts: jitter });
  score = Math.min(97, Math.max(35, score + jitter));
  return { score, parts };
}
export const rateIdea = (t: string) => rateIdeaDetailed(t).score;
export const scoreColor = (s: number) => (s >= 75 ? '#7be0b0' : s >= 55 ? '#e0c97b' : '#ff9d9d');

export function textSimilarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union ? inter / union : 0;
}

export function isVoteReasonRelevant(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  if (/^(bo+h?|ok|va bene|si|no|niente|boh|top|bello|brutto)$/i.test(t)) return false;
  return t.split(/\s+/).filter((w) => w.length > 3).length >= 2;
}

/* ---------- profili ---------- */
export function followerCountFor(name: string, me: string, demo: boolean): number {
  if (!demo) return name === me ? 0 : 0;
  const base = name === me ? 34 : 20;
  return base + Math.floor(mulberry32(hashStr(name + 'followers'))() * 300);
}

export function ratingFor(name: string) {
  const counts = useNet.getState().votes[name] ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const count = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!count) return { avg: null as string | null, count: 0, counts };
  const sum = Object.entries(counts).reduce((s, [star, n]) => s + Number(star) * n, 0);
  return { avg: (sum / count).toFixed(1), count, counts };
}

export function receivedLPFor(name: string): number {
  const s = useNet.getState();
  return s.ideas.filter((i) => i.author === name).reduce((a, i) => a + i.raised, 0) + (s.receivedDaily[name] || 0) + (s.receivedPayments[name] || 0);
}

export function bioFor(name: string, me: string): string {
  const s = useNet.getState();
  if (name === me) return s.bio;
  const p = s.providers.find((x) => x.name === name);
  return p ? p.role : 'Membro della community LifeNetwork';
}

export function badgesFor(name: string, me: string): string[] {
  const s = useNet.getState();
  const b: string[] = [];
  if (s.ideas.some((i) => i.author === name)) b.push('Prima idea pubblicata');
  if (s.clubs[name]) b.push('Fondatore di un LifeClub');
  if (s.communities.some((c) => c.owner === name)) b.push('Community creata');
  if (s.posts.some((p) => p.author === name)) b.push('Primo post pubblicato');
  if (name === me && donationStreak() >= 7) b.push('7 giorni di LifePoint donato');
  return b;
}

export function trustScore(name: string): number {
  const s = useNet.getState();
  const received = s.ideas.filter((i) => i.author === name).reduce((a, i) => a + i.raised, 0);
  return Math.max(0, received + (s.receivedDaily[name] || 0) * 10 - (s.reports[name] || 0) * 50);
}

export function donationStreak(): number {
  const { dailyHistory, dailyPoint } = useNet.getState();
  if (!dailyHistory.length) return 0;
  let streak = 0;
  const expected = new Date();
  if (dailyPoint.lastGiven !== shortDate(0)) expected.setDate(expected.getDate() - 1);
  for (const entry of dailyHistory) {
    const str = `${String(expected.getDate()).padStart(2, '0')}/${String(expected.getMonth() + 1).padStart(2, '0')}`;
    if (entry.date === str) { streak++; expected.setDate(expected.getDate() - 1); } else break;
  }
  return streak;
}

export function isWithinDays(dateStr: string, days: number): boolean {
  const [d, m] = dateStr.split('/').map(Number);
  const now = new Date();
  const dt = new Date(now.getFullYear(), m - 1, d);
  now.setHours(0, 0, 0, 0);
  const diff = (now.getTime() - dt.getTime()) / 86400000;
  return diff >= 0 && diff < days;
}

export const unreadMessages = (me: string): number => totalUnread(me);

export const peoplePool = (me: string): string[] => {
  const s = useNet.getState();
  return [...new Set([...s.suggested, ...s.following, ...s.posts.map((p) => p.author), ...s.communities.flatMap((c) => c.members), ...Object.values(useChat.getState().chats).filter((c) => c.type === 'dm').map((c) => c.name)])].filter((n) => n !== me);
};

export const fxRates: Record<string, number> = { CHF: 1, EUR: 0.96, USD: 1.05, GBP: 0.83 };
export const cryptoRates: Record<string, number> = { BTC: 0.0000094, ETH: 0.00027 };
export function convertAmount(chf: number, currency: string): number {
  if (currency === 'CHF') return chf;
  if (fxRates[currency]) return chf * fxRates[currency] * 1.02;
  if (cryptoRates[currency]) return chf * cryptoRates[currency];
  return chf;
}
export type { Idea };
