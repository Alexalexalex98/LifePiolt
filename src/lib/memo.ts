/**
 * Promemoria liberi («ricordami di chiamare l'idraulico domani alle 9»): logica PURA per date, ripetizioni e lettura delle frasi.
 * La programmazione delle notifiche sta in lib/memoSync.ts. Niente import di react-native o alias '@/'.
 */
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type Memo = { id: string; text: string; /** primo orario, in millisecondi */ at: number; repeat: Repeat; done?: boolean; doneAt?: number };

export const REPEAT_LABEL: Record<Repeat, string> = { none: 'Una volta', daily: 'Ogni giorno', weekly: 'Ogni settimana', monthly: 'Ogni mese' };
const DAY = 86400000;

export const pad = (n: number) => String(n).padStart(2, '0');
export const dayStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Data e ora locali ('2026-10-30', '09:30') -> millisecondi; NaN se non valide. */
export function whenOf(date: string, time: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), h = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m || !h) return NaN;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]), 0, 0);
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) && Number(h[1]) < 24 && Number(h[2]) < 60 ? d.getTime() : NaN;
}

/** La k-esima occorrenza (0 = la prima) di un promemoria. */
export function occurrence(m: Memo, k: number): number {
  const d = new Date(m.at);
  if (m.repeat === 'daily') d.setDate(d.getDate() + k);
  else if (m.repeat === 'weekly') d.setDate(d.getDate() + 7 * k);
  else if (m.repeat === 'monthly') { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + k); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  return d.getTime();
}

/** Le prossime occorrenze da `now` in poi (al massimo `n`). Un promemoria fatto, o non ripetuto e passato, non ne ha. */
export function nextOccurrences(m: Memo, now: number, n = 1): number[] {
  if (m.done && m.repeat === 'none') return [];
  const out: number[] = [];
  const first = m.repeat === 'none' ? 0 : Math.max(0, Math.floor((now - m.at) / (m.repeat === 'daily' ? DAY : m.repeat === 'weekly' ? 7 * DAY : 28 * DAY)) - 1);
  for (let k = first; k < first + 500 && out.length < n; k++) {
    const t = occurrence(m, k);
    if (t > now) out.push(t);
    if (m.repeat === 'none') break;
  }
  return out;
}
export const nextOf = (m: Memo, now: number): number | null => nextOccurrences(m, now, 1)[0] ?? null;

/** Quelli da fare, dal più vicino; poi (a parte) quelli scaduti non fatti. */
export function sortedMemos(list: Memo[], now: number): { upcoming: (Memo & { next: number })[]; overdue: Memo[]; done: Memo[] } {
  const upcoming = list.filter((m) => !m.done).map((m) => ({ ...m, next: nextOf(m, now) })).filter((m): m is Memo & { next: number } => m.next != null).sort((a, b) => a.next - b.next);
  const overdue = list.filter((m) => !m.done && m.repeat === 'none' && m.at <= now).sort((a, b) => b.at - a.at);
  const done = list.filter((m) => m.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  return { upcoming, overdue, done };
}

/** Il promemoria cade in questo giorno (AAAA-MM-GG)? */
export function occursOn(m: Memo, day: string): boolean {
  if (m.done) return false;
  const start = new Date(m.at); const d0 = dayStr(start);
  if (day < d0) return false;
  if (m.repeat === 'none') return day === d0;
  const d = new Date(`${day}T12:00:00`);
  if (m.repeat === 'daily') return true;
  if (m.repeat === 'weekly') return d.getDay() === start.getDay();
  return d.getDate() === start.getDate() || (start.getDate() > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() && d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
}

/** Che notifiche programmare: le prossime occorrenze di tutti, dal più vicino, al massimo `max` (iOS ne tiene 64 in tutto). */
export function planMemos(list: Memo[], now: number, max = 24): { id: string; at: number; text: string; memoId: string }[] {
  const all: { id: string; at: number; text: string; memoId: string }[] = [];
  for (const m of list) {
    const per = m.repeat === 'none' ? 1 : m.repeat === 'daily' ? 8 : m.repeat === 'weekly' ? 6 : 4;
    nextOccurrences(m, now, per).forEach((at, i) => all.push({ id: `lp-rem-${m.id}-${i}`, at, text: m.text, memoId: m.id }));
  }
  return all.sort((a, b) => a.at - b.at).slice(0, max);
}

/* ---------- lettura delle frasi: «ricordami di chiamare l'idraulico domani alle 9» ---------- */
const WD: Record<string, number> = { domenica: 0, lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 };
/** Minuscolo senza accenti né apostrofi, UNO A UNO (stessa lunghezza): serve a cercare nel testo e togliere la stessa parte dall'originale. */
const fold = (s: string) => s.replace(/[àáâä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i').replace(/[òóôö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/['’`]/g, ' ');
const low = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const norm = (s: string) => fold(low(s));
const TRIGGER = /^(?:(?:per favore|per piacere|ciao|theia)[, ]+)?(?:ricordami|ricorda mi|ricordami di|fammi ricordare|mettimi un promemoria|metti un promemoria|crea un promemoria|aggiungi un promemoria|imposta un promemoria)\b[: ,]*(?:di |che |per )?/;

export type ParsedMemo = { text: string; at: number; repeat: Repeat } | { text: string; missing: 'time' | 'date' };
export const looksLikeMemo = (s: string): boolean => TRIGGER.test(norm(s));
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Legge «ricordami di … [quando]». Se manca l'ora o il giorno lo dice (così Theia lo chiede); non inventa. */
export function parseMemo(raw: string, now: number): ParsedMemo | null {
  let orig = low(raw);
  let s = fold(orig);
  const tm = TRIGGER.exec(s);
  if (!tm) return null;
  orig = orig.slice(tm[0].length); s = s.slice(tm[0].length);
  const base = new Date(now);
  let date: Date | null = null; let h: number | null = null; let min = 0; let repeat: Repeat = 'none';
  const take = (re: RegExp): RegExpExecArray | null => { const m = re.exec(s); if (m) { orig = orig.slice(0, m.index) + ' '.repeat(m[0].length) + orig.slice(m.index + m[0].length); s = s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length); } return m; };

  if (take(/\bogni giorno\b|\btutti i giorni\b|\bquotidianamente\b/)) repeat = 'daily';
  else if (take(/\bogni settimana\b|\btutte le settimane\b/)) repeat = 'weekly';
  else if (take(/\bogni mese\b|\btutti i mesi\b/)) repeat = 'monthly';

  let m: RegExpExecArray | null;
  if ((m = take(/\btra (\d+|un|una|mezz) ?(minut\w*|ora|ore|\bh\b)/)) || (m = take(/\btra (un'? )?(ora|mezz ora)\b/))) {
    const n = /mezz/.test(m[0]) ? 30 : /^\d+$/.test(m[1] ?? '') ? Number(m[1]) : 1;
    const mins = /minut/.test(m[0]) || /mezz/.test(m[0]) ? n : n * 60;
    const t = new Date(now + mins * 60000);
    return { text: tidy(orig), at: t.getTime(), repeat };
  }
  if (take(/\bdopodomani\b/)) { date = new Date(base); date.setDate(date.getDate() + 2); }
  else if (take(/\bdomani\b/)) { date = new Date(base); date.setDate(date.getDate() + 1); }
  else if (take(/\boggi\b/)) date = new Date(base);
  else if ((m = take(/\b(?:(?:il|di|lunedi prossimo|prossimo)\s+)?(domenica|lunedi|martedi|mercoledi|giovedi|venerdi|sabato)\b(?: prossimo)?/))) {
    const wd = WD[m[1]!]!; date = new Date(base);
    let add = (wd - date.getDay() + 7) % 7; if (add === 0) add = 7; date.setDate(date.getDate() + add);
  } else if ((m = take(/\b(?:il )?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/))) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear();
    date = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (!m[3] && date.getTime() < now - DAY) date.setFullYear(y + 1);
  }
  if (take(/\bstasera\b|\bquesta sera\b/)) { h = 20; date ??= new Date(base); }
  else if (take(/\bstamattina\b|\bquesta mattina\b/)) { h = 9; date ??= new Date(base); }
  else if (take(/\bdomattina\b/)) { h = 9; date ??= (() => { const d = new Date(base); d.setDate(d.getDate() + 1); return d; })(); }
  else if (take(/\bstanotte\b/)) { h = 23; date ??= new Date(base); }
  if ((m = take(/\b(?:alle ore|alle|all|ore)\s*(\d{1,2})(?:[:.h](\d{2}))?\b(?:\s*(?:e mezza|e mezzo))?/))) {
    h = Number(m[1]); min = m[2] ? Number(m[2]) : /e mezz/.test(m[0]) ? 30 : 0;
    if (/\bdi sera\b|\bdel pomeriggio\b|\bpomeridian\w*/.test(s) && h < 12) h += 12;
    take(/\b(di sera|del pomeriggio|di mattina|del mattino|di notte)\b/);
  } else if ((m = take(/\ball (?:una|1)\b/))) { h = 1; }
  else if (take(/\bmezzogiorno\b/)) h = 12;
  else if (take(/\bmezzanotte\b/)) h = 0;
  const text = tidy(orig);
  if (!text) return null;
  if (h == null || h > 23 || min > 59) return { text, missing: 'time' };
  if (!date) { date = new Date(base); if (new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, min).getTime() <= now) date.setDate(date.getDate() + 1); }
  const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, min, 0, 0).getTime();
  return { text, at, repeat };
}
const tidy = (s: string) => cap(s.replace(/\s+/g, ' ').trim().replace(/\s+(di|che|per|a|alle|il|la|l')$/, '').replace(/^(di|che)\s+/, ''));
