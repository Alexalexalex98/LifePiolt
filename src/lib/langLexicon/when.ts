import { EN_DAYS, EN_MONTHS, groupIndex, numOf, rx } from './build.ts';
import type { LexData } from './types.ts';

export type Hint = 'morning' | 'afternoon' | 'evening';
export type WhenOut = {
  day?: string;          // già in inglese canonico: "tomorrow", "Friday", "in 3 days", "12 October"
  recur?: string;        // "every Tuesday" | "every day" | "every week"
  start?: string;        // "3pm" | "3:30pm" | "midnight"
  end?: string;
  dur?: string;          // "2 hours" | "30 minutes"
  hint?: Hint;
  spans: [number, number][];
  /** ci sono parti di data/ora riconosciute */
  any: boolean;
};

const blank = (f: string, a: number, b: number) => f.slice(0, a) + ' '.repeat(b - a) + f.slice(b);

export function fmtClock(h: number, mi: number): string {
  const hh = ((h % 24) + 24) % 24;
  const ap = hh >= 12 ? 'pm' : 'am';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}${mi ? ':' + String(mi).padStart(2, '0') : ''}${ap}`;
}

type Clock = { h: number; mi: number };

/** Ora (0..24) da gruppi: applica mezza/quarti, am/pm, fascia del giorno e l'euristica dell'assistente (1..6 senza indicazione = pomeriggio). */
function clockFrom(lex: LexData, g: Record<string, string | undefined>, hint: Hint | undefined, suf = ''): Clock | undefined {
  const get = (k: string) => g[k + suf];
  let h = numOf(lex, get('h') ?? get('hb') ?? get('hq'));
  if (h == null) return undefined;
  let mi = numOf(lex, get('m')) ?? 0;
  if (get('half') !== undefined) mi = 30;
  if (get('qa') !== undefined) mi = 15;
  let shifted = false;
  if (get('hb') !== undefined) { h -= 1; mi = 30; shifted = true; }
  if (get('qb') !== undefined) { h -= 1; mi = 45; shifted = true; }
  const ap = get('ap');
  const apn = get('apn');
  const isPm = ap ? rx(lex, lex.pm).test(ap) : false;
  const isAm = ap ? rx(lex, lex.am).test(ap) : false;
  if (mi > 59 || h > 24 || h < 0) return undefined;
  const hr = shifted ? h + 1 : h; // l'ora "nominale" decide am/pm
  let out = h;
  if (apn !== undefined) { out = hr >= 6 && hr < 12 ? h + 12 : hr === 12 ? h - 12 : h; }
  else if (isPm && hr < 12) out = h + 12;
  else if (isAm && hr === 12) out = h - 12;
  else if (!isPm && !isAm && hr < 13 && hr > 0) {
    if (hint === 'evening' && hr >= 4 && hr < 12) out = h + 12;
    else if (hint === 'afternoon' && hr < 12) out = h + 12;
    else if (hint === 'morning') out = h;
    else if (hr >= 1 && hr <= 6) out = h + 12;
  }
  if (out < 0) out += 24;
  return { h: out >= 24 ? out - 24 : out, mi };
}

/** Estrae data/ora/durata/ricorrenza da un testo piegato `f0` e lo restituisce con quelle parti sostituite da spazi. */
export function extractWhen(lex: LexData, f0: string): { when: WhenOut; f: string } {
  let f = f0;
  const w: WhenOut = { spans: [], any: false };
  const take = (m: RegExpExecArray | null) => {
    if (!m) return null;
    w.spans.push([m.index, m.index + m[0].length]);
    f = blank(f, m.index, m.index + m[0].length);
    w.any = true;
    return m;
  };
  const first = (srcs: string[]): RegExpExecArray | null => {
    for (const s of srcs) { const m = rx(lex, s).exec(f); if (m) return m; }
    return null;
  };

  // fascia del giorno (serve per capire am/pm), calcolata sul testo intero
  const hintOf = (s: string): Hint | undefined =>
    rx(lex, lex.hintEvening).test(s) ? 'evening' : rx(lex, lex.hintAfternoon).test(s) ? 'afternoon' : rx(lex, lex.hintMorning).test(s) ? 'morning' : undefined;
  const hint0 = hintOf(f0);

  // 1) ricorrenza: "ogni martedì", "ogni giorno"
  {
    const m = rx(lex, `(?:${lex.every})\\s*(?:{wd}|(?<dw>${lex.dayWord})|(?<ww>${lex.weekWord}))`).exec(f);
    if (m) {
      const wi = groupIndex(m, 'w', 7);
      w.recur = wi >= 0 ? `every ${EN_DAYS[wi]}` : m.groups?.dw !== undefined ? 'every day' : 'every week';
      take(m);
    }
  }
  // 2) tra N giorni/settimane/mesi
  {
    const m = first(lex.inN);
    if (m) {
      const n = m.groups?.dual !== undefined ? 2 : m.groups?.n === undefined ? 1 : numOf(lex, m.groups.n);
      const u = m.groups?.u ?? '';
      if (n != null && n > 0) {
        const unit = rx(lex, lex.unitDay).test(u) ? 'day' : rx(lex, lex.unitWeek).test(u) ? 'week' : rx(lex, lex.unitMonth).test(u) ? 'month' : '';
        if (unit) { w.day = `in ${n} ${unit}${n === 1 ? '' : 's'}`; take(m); }
      }
    }
  }
  // 3) durata (prima degli orari: "2h" è una durata se c'è «per/pendant/für...»)
  {
    const m = first(lex.dur);
    if (m && m.groups?.n !== undefined) {
      const n = numOf(lex, m.groups.n);
      if (n != null && n > 0) {
        const isMin = rx(lex, lex.unitMin).test(m.groups.u ?? '');
        w.dur = isMin ? `${n} minute${n === 1 ? '' : 's'}` : `${n} hour${n === 1 ? '' : 's'}`;
        take(m);
      }
    } else if (lex.halfHour && rx(lex, lex.halfHour).exec(f)) { take(rx(lex, lex.halfHour).exec(f)); w.dur = '30 minutes'; }
    else if (lex.oneHour && rx(lex, lex.oneHour).exec(f)) { take(rx(lex, lex.oneHour).exec(f)); w.dur = '1 hour'; }
  }
  // 3) orari: intervallo, poi singolo (prima delle date numeriche, che userebbero gli stessi numeri)
  {
    const m = first(lex.range);
    const g = m?.groups as Record<string, string | undefined> | undefined;
    if (m && g) {
      const a = clockFrom(lex, g, hint0, '1'), b = clockFrom(lex, g, hint0, '2');
      if (a && b) {
        if (b.h * 60 + b.mi <= a.h * 60 + a.mi && b.h < 12 && !g.ap2) b.h += 12;
        if (b.h * 60 + b.mi > a.h * 60 + a.mi) { w.start = fmtClock(a.h, a.mi); w.end = fmtClock(b.h, b.mi); take(m); }
      }
    }
  }
  if (!w.start) {
    for (const s of lex.time) {
      const m = rx(lex, s).exec(f);
      const g = m?.groups as Record<string, string | undefined> | undefined;
      if (m && g) { const c = clockFrom(lex, g, hint0); if (c) { w.start = fmtClock(c.h, c.mi); take(m); break; } }
    }
  }
  if (!w.start) {
    if (lex.noon && (rx(lex, lex.noon).exec(f))) { take(rx(lex, lex.noon).exec(f)); w.start = '12pm'; }
    else if (lex.midnight && rx(lex, lex.midnight).exec(f)) { take(rx(lex, lex.midnight).exec(f)); w.start = 'midnight'; }
  }
  // 5) giorno: data, relativo, prossima settimana, giorno della settimana
  if (!w.day) {
    for (const s of lex.dates) {
      const m = rx(lex, s).exec(f);
      if (!m) continue;
      const mi = groupIndex(m, 'mo', 12);
      const mnum = mi >= 0 ? mi + 1 : numOf(lex, m.groups?.mn);
      const d = numOf(lex, m.groups?.d);
      if (d != null && mnum != null && d >= 1 && d <= 31 && mnum >= 1 && mnum <= 12) { w.day = `${d} ${EN_MONTHS[mnum - 1]}`; take(m); break; }
    }
  }
  if (!w.day) {
    const m = rx(lex, '(?<![\\d/])(\\d{1,2})[/-](\\d{1,2})(?![\\d:])', false).exec(f);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31 && Number(m[2]) >= 1 && Number(m[2]) <= 12) { w.day = `${Number(m[1])}/${Number(m[2])}`; take(m); }
  }
  if (!w.day && !w.recur) {
    const tryDay = (src: string, en: string) => { const m = rx(lex, src).exec(f); if (m) { w.day = en; take(m); return true; } return false; };
    if (!tryDay(lex.dayafter, 'the day after tomorrow') && !tryDay(lex.tomorrow, 'tomorrow') && !tryDay(lex.yesterday, 'yesterday') && !tryDay(lex.today, 'today')
      && !tryDay(lex.nextweek, 'next week') && !tryDay(lex.thisweek, 'this week')) {
      const m = rx(lex, '{wd}').exec(f);
      if (m) { const wi = groupIndex(m, 'w', 7); if (wi >= 0) { w.day = EN_DAYS[wi]; take(m); } }
    }
  } else if (w.recur && !w.day) {
    // "ogni martedì domani"? raro: ignoro il giorno
  }
  // 6) fascia (dopo aver tolto gli orari, per non mangiarne le parole)
  if (hint0) {
    w.hint = hint0;
    for (const [src, h] of [[lex.hintEvening, 'evening'], [lex.hintAfternoon, 'afternoon'], [lex.hintMorning, 'morning']] as const) {
      if (h !== hint0) continue;
      const m = rx(lex, src).exec(f);
      if (m) { w.spans.push([m.index, m.index + m[0].length]); f = blank(f, m.index, m.index + m[0].length); w.any = true; }
    }
  }
  return { when: w, f };
}

/** Frase inglese di data/ora: "tomorrow at 3pm for 2 hours". */
export function whenEn(w: WhenOut, opts: { ignoreRecur?: boolean } = {}): string {
  const parts: string[] = [];
  if (w.day) parts.push(w.day);
  else if (w.hint && !w.start) parts.push('this');
  if (w.hint && !w.start) parts.push(w.hint);
  if (w.start && w.end) parts.push(`from ${w.start} to ${w.end}`);
  else if (w.start) parts.push(w.start === 'midnight' ? 'at midnight' : `at ${w.start}`);
  if (w.dur) parts.push(`for ${w.dur}`);
  void opts;
  return parts.join(' ').trim();
}
