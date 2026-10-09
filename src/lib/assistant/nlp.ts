/**
 * Comprensione dell'italiano E dell'inglese senza AI (insieme, senza selezione): date, orari, durate, titoli e riconoscimento del comando.
 * Modulo PURO (nessun import dall'app) così si prova con numeri noti. Tutto è regole e espressioni regolari:
 * non "capisce" qualsiasi frase, ma gestisce bene le richieste tipiche e, se non capisce, chiede o suggerisce.
 */
import { t } from '../../i18n/core.ts';

export const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const norm = (s: string) => stripAccents(s.toLowerCase()).replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDaysTo = (d: Date, n: number) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const fromKey = (k: string) => new Date(k + 'T00:00:00');

const wdNames = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const wdLabel = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const weekdayName = (i: number) => [t('domenica'), t('lunedì'), t('martedì'), t('mercoledì'), t('giovedì'), t('venerdì'), t('sabato')][i];
const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const wdEn = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const monthEn = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthEnShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthEnIdx = (x: string) => { const i = monthEn.indexOf(x); if (i >= 0) return i; const j = monthEnShort.indexOf(x.slice(0, 3)); return j; };
const numWords: Record<string, number> = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12, quindici: 15, venti: 20, trenta: 30, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : numWords[s]);

export const dayLabel = (key: string, now: Date) => {
  const d = fromKey(key), tk = dayKeyOf(now);
  if (key === tk) return t('oggi');
  if (key === dayKeyOf(addDaysTo(now, 1))) return t('domani');
  if (key === dayKeyOf(addDaysTo(now, 2))) return t('dopodomani');
  return `${weekdayName(d.getDay())} ${d.getDate()}/${d.getMonth() + 1}`;
};

type Span = [number, number];
export type When = { day?: string; time?: string; endTime?: string; durationMin?: number; hint?: 'mattina' | 'pomeriggio' | 'sera'; spans: Span[] };

/** Cerca giorno, ora, durata e fascia in una frase. `spans` sono le parti del testo (normalizzato) già usate: servono per ripulire il titolo. */
export function parseWhen(raw: string, now: Date): When {
  const s = norm(raw);
  const out: When = { spans: [] };
  const mark = (m: RegExpExecArray | null) => { if (m) out.spans.push([m.index, m.index + m[0].length]); return m; };
  let m: RegExpExecArray | null;
  const wdAltEn = wdEn.join('|');
  const monAltEn = `${monthEn.join('|')}|${monthEnShort.join('|')}|sept`;
  const nthDay = (target: number) => { let diff = (target - now.getDay() + 7) % 7; if (diff === 0) diff = 7; return dayKeyOf(addDaysTo(now, diff)); };

  // ---- giorno ----
  if ((m = mark(/\bdopo ?domani\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, 2));
  else if ((m = mark(/\b(?:the )?day after tomorrow\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, 2));
  else if ((m = mark(/\bdomani( sera| mattina| pomeriggio)?\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, 1));
  else if ((m = mark(/\btomorrow\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, 1));
  else if ((m = mark(/\bieri\b|\byesterday\b/.exec(s)))) out.day = dayKeyOf(addDaysTo(now, -1));
  else if ((m = mark(/\b(oggi|stasera|stamattina|stamani|questa sera|questa mattina|questo pomeriggio|stanotte)\b/.exec(s)))) out.day = dayKeyOf(now);
  else if ((m = mark(/\b(today|tonight|this morning|this afternoon|this evening)\b/.exec(s)))) out.day = dayKeyOf(now);
  else if ((m = mark(/\b(?:tra|fra) (\d+|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci) (giorn[oi]|settiman[ae]|mes[ei])\b/.exec(s)))) {
    const n = num(m[1]) ?? 1; const u = m[2];
    out.day = dayKeyOf(addDaysTo(now, u.startsWith('giorn') ? n : u.startsWith('settim') ? n * 7 : n * 30));
  } else if ((m = mark(/\bin (\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty) (days?|weeks?|months?)\b/.exec(s)))) {
    const n = num(m[1]) ?? 1; const u = m[2];
    out.day = dayKeyOf(addDaysTo(now, u.startsWith('day') ? n : u.startsWith('week') ? n * 7 : n * 30));
  } else if ((m = mark(/\b(?:la )?settimana prossima\b|\bprossima settimana\b|\bnext week\b/.exec(s)))) {
    const d = (8 - now.getDay()) % 7 || 7; out.day = dayKeyOf(addDaysTo(now, d)); // lunedì prossimo
  } else if ((m = mark(/\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)( prossim[oa])?\b/.exec(s)))) {
    out.day = nthDay(wdNames.indexOf(m[1]));
  } else if ((m = mark(new RegExp(`\\b(?:(?:on|next|this|coming) )?(${wdAltEn})\\b`).exec(s)))) {
    out.day = nthDay(wdEn.indexOf(m[1]));
  } else if ((m = mark(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b(?![:\d])/.exec(s)))) {
    const dd = Number(m[1]), mm = Number(m[2]) - 1; let y = m[3] ? Number(m[3]) : now.getFullYear(); if (y < 100) y += 2000;
    let d = new Date(y, mm, dd);
    if (!m[3] && d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(y + 1, mm, dd);
    if (d.getMonth() === mm) out.day = dayKeyOf(d);
  } else if ((m = mark(new RegExp(`\\b(\\d{1,2}) (${monthNames.join('|')}|${monthNames.map((x) => x.slice(0, 3)).join('|')})\\b`).exec(s)))) {
    const mm = monthNames.findIndex((x) => x === m![2] || x.slice(0, 3) === m![2]); const dd = Number(m[1]);
    let d = new Date(now.getFullYear(), mm, dd);
    if (d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(now.getFullYear() + 1, mm, dd);
    out.day = dayKeyOf(d);
  } else if ((m = mark(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?: of)? (${monAltEn})\\b`).exec(s)))) {
    const mm = monthEnIdx(m[2]); const dd = Number(m[1]);
    let d = new Date(now.getFullYear(), mm, dd);
    if (d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(now.getFullYear() + 1, mm, dd);
    out.day = dayKeyOf(d);
  } else if ((m = mark(new RegExp(`\\b(${monAltEn})\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b(?! ?[:.]\\d)`).exec(s)))) {
    const mm = monthEnIdx(m[1]); const dd = Number(m[2]);
    let d = new Date(now.getFullYear(), mm, dd);
    if (d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(now.getFullYear() + 1, mm, dd);
    out.day = dayKeyOf(d);
  } else if ((m = mark(/\bil (\d{1,2})\b(?! ?[:.]\d)/.exec(s))) || (m = mark(/\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)\b/.exec(s)))) {
    const dd = Number(m[1]);
    if (dd >= 1 && dd <= 31) {
      let d = new Date(now.getFullYear(), now.getMonth(), dd);
      if (d < addDaysTo(now, 0) && dayKeyOf(d) !== dayKeyOf(now)) d = new Date(now.getFullYear(), now.getMonth() + 1, dd);
      out.day = dayKeyOf(d);
    }
  }

  // ---- fascia ----
  const hintM = /\b(mattina|mattino|stamattina|stamani|morning)\b/.exec(s) ? 'mattina' : /\b(pomeriggio|afternoon)\b/.exec(s) ? 'pomeriggio' : /\b(sera|stasera|notte|evening|tonight|night)\b/.exec(s) ? 'sera' : undefined;
  if (hintM) out.hint = hintM;

  // ---- ora o intervallo ----
  const toTime = (h: number, mi: number, extra: string) => {
    let hh = h;
    if (/\bpomeriggio\b|\bsera\b|\bstasera\b|\bnotte\b|\bafternoon\b|\bevening\b|\btonight\b|\bnight\b/.test(extra) && hh < 12) hh += 12;
    else if (!/\bmattina\b|\bmattino\b|\bstamattina\b|\bmorning\b/.test(extra) && hh >= 1 && hh <= 6) hh += 12;
    if (hh > 23 || mi > 59) return undefined;
    return `${pad(hh)}:${pad(mi)}`;
  };
  /** ora inglese con am/pm esplicito (nessuna euristica) */
  const withAp = (h: number, mi: number, ap: string | undefined, extra: string) => {
    if (!ap) return toTime(h, mi, extra);
    let hh = h % 12; if (ap.startsWith('p')) hh += 12;
    if (h > 12 || mi > 59) return h <= 23 ? `${pad(h)}:${pad(mi)}` : undefined;
    return `${pad(hh)}:${pad(mi)}`;
  };
  const rangeEn = /\b(?:from|between) (\d{1,2})(?:[:.](\d{2}))? ?(am|pm)? ?(?:to|and|until|till|-) ?(\d{1,2})(?:[:.](\d{2}))? ?(am|pm)?\b/.exec(s);
  const range = /\bdalle? (\d{1,2})(?:[:.h](\d{2}))? (?:alle?|a) (\d{1,2})(?:[:.h](\d{2}))?\b/.exec(s);
  const setRange = (a: string | undefined, b: string | undefined) => {
    out.time = a; out.endTime = b;
    if (out.time && out.endTime) { const [x, y] = [out.time, out.endTime].map((q) => Number(q.slice(0, 2)) * 60 + Number(q.slice(3))); if (y > x) out.durationMin = y - x; }
  };
  if (rangeEn) {
    mark(rangeEn);
    const ap1 = rangeEn[3] ?? (rangeEn[6] && Number(rangeEn[1]) <= Number(rangeEn[4]) ? rangeEn[6] : undefined);
    setRange(withAp(Number(rangeEn[1]), Number(rangeEn[2] ?? 0), ap1, s), withAp(Number(rangeEn[4]), Number(rangeEn[5] ?? 0), rangeEn[6], s));
  } else if (range) {
    mark(range);
    setRange(toTime(Number(range[1]), Number(range[2] ?? 0), s), toTime(Number(range[3]), Number(range[4] ?? 0), s));
  } else if ((m = mark(/\b(half past|quarter past|quarter to) (\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/.exec(s)))) {
    const h = /^\d/.test(m[2]) ? Number(m[2]) : ({ eleven: 11 } as Record<string, number>)[m[2]] ?? num(m[2])!;
    out.time = m[1] === 'half past' ? toTime(h, 30, s) : m[1] === 'quarter past' ? toTime(h, 15, s) : toTime(h - 1, 45, s);
  } else if ((m = mark(/\b(?:at|@|around|from) (\d{1,2})(?:[:.](\d{2}))? ?(am|pm)?(?: ?o'?clock)?\b/.exec(s)))) {
    out.time = withAp(Number(m[1]), Number(m[2] ?? 0), m[3], s);
  } else if ((m = mark(/\b(\d{1,2})(?:[:.](\d{2}))? ?(am|pm)\b/.exec(s)))) {
    out.time = withAp(Number(m[1]), Number(m[2] ?? 0), m[3], s);
  } else if ((m = mark(/\b(?:alle|alle ore|ore|all'|verso le|per le|h) ?(\d{1,2})(?:(?:[:.h]| e )(\d{2}|mezza|un quarto|quarto))?\b/.exec(s)))) {
    let mi = 0; const frag = m[2];
    if (frag) mi = frag === 'mezza' ? 30 : frag === 'un quarto' || frag === 'quarto' ? 15 : Number(frag);
    out.time = toTime(Number(m[1]), mi, s);
  } else if ((m = mark(/\b(mezzogiorno|noon|midday)\b/.exec(s)))) out.time = '12:00';
  else if ((m = mark(/\b(mezzanotte|midnight)\b/.exec(s)))) out.time = '23:59';
  else if ((m = mark(/\b(\d{1,2}):(\d{2})\b/.exec(s)))) out.time = toTime(Number(m[1]), Number(m[2]), s);

  // ---- durata ----
  if (out.durationMin == null) {
    if ((m = mark(/\bper (\d+|un|una|due|tre|quattro|mezza|mezz'|un'?) ?(?:ora e mezza|ore|ora|minuti|min|h)\b/.exec(s)))) {
      const unit = /min/.test(m[0]) ? 1 : 60; const raw = m[1];
      const n = raw.startsWith('mezz') ? 0.5 : num(raw.replace("'", '')) ?? 1;
      out.durationMin = /ora e mezza/.test(m[0]) ? 90 : Math.round(n * unit);
    } else if ((m = mark(/\b(un'ora|mezz'ora|mezzora)\b/.exec(s)))) out.durationMin = /mezz/.test(m[1]) ? 30 : 60;
    else if ((m = mark(/\bfor (an hour and a half|half an hour|half hour|an hour|a couple of hours)\b/.exec(s)))) out.durationMin = m[1] === 'an hour and a half' ? 90 : /half/.test(m[1]) ? 30 : m[1] === 'an hour' ? 60 : 120;
    else if ((m = mark(/\bfor (\d+(?:[.,]\d+)?|an?|one|two|three|four|five|six) ?(hours?|hrs?|h|minutes?|mins?)\b/.exec(s)))) {
      const unit = /^m/.test(m[2]) ? 1 : 60; const n = /^\d/.test(m[1]) ? parseFloat(m[1].replace(',', '.')) : num(m[1]) ?? 1;
      out.durationMin = Math.round(n * unit);
    } else if ((m = mark(/\b(half an hour|half hour)\b/.exec(s)))) out.durationMin = 30;
  }
  return out;
}

/** Rimuove dal testo originale (normalizzato) le parti già interpretate come data/ora. */
export function withoutSpans(raw: string, spans: Span[]): string {
  const s = norm(raw);
  let r = '', last = 0;
  [...spans].sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { if (a >= last) { r += s.slice(last, a) + ' '; last = b; } });
  return (r + s.slice(last)).replace(/\s+/g, ' ').trim();
}

/** Parole da togliere per ottenere il titolo di ciò che si vuole aggiungere. */
const fillers = /\b(per favore|per piacere|gentilmente|potresti|puoi|vorrei|voglio|dovresti|ti chiedo di|mi serve|devo|ricordami di|ricordami|aggiungi|aggiungimi|aggiungere|inserisci|inserire|metti|mettimi|segna|segnami|programma|pianifica|fissa|fissami|prenota|crea|creami|nuovo|nuova|un|una|uno|il|lo|la|l'|i|gli|le|al|alla|allo|ai|nel|nella|nell'|sul|sulla|sull'|piano|nel piano|nel mio piano|al mio piano|al piano|in calendario|nel calendario|sul calendario|calendario|agenda|nell'agenda|nella mia agenda|impegno|evento|appuntamento|promemoria|task|attivita|cosa da fare|nota|appunto|di|da|per|a|ad|in|con|e|che|mio|mia|miei|mie|quando|dove|please|remind me to|remind me|remember to|don't forget to|could you|can you|would you|i want to|i need to|i would like to|i'd like to|i have|(?:to|in|into|on|onto) (?:my |the )?(?:plan|calendar|agenda|schedule)|add|put|schedule|set up|book|create|new|an|the|to|my|calendar|event|appointment|reminder|at|on|for|into)\b/g;
export function extractTitle(raw: string, spans: Span[], extraStrip?: RegExp): string {
  let s = withoutSpans(raw, spans);
  if (extraStrip) s = s.replace(extraStrip, ' ');
  // tieni il testo originale (con maiuscole e accenti) delle parole rimaste
  const keepWords = s.replace(fillers, ' ').replace(/[?!.,;:"]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!keepWords) return '';
  const orig = raw.split(/\s+/);
  const keep = new Set(keepWords.split(' '));
  const out = orig.filter((w) => keep.has(norm(w).replace(/[?!.,;:"]/g, ''))).join(' ').replace(/[?!.,;:"]+$/g, '').trim();
  const t = out || keepWords;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Somiglianza fra una frase e il titolo di un task/impegno (parole in comune, 0..1). */
export function similarity(query: string, title: string): number {
  const stop = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'da', 'a', 'in', 'con', 'per', 'del', 'della', 'e', 'al', 'alla', 'task', 'impegno', 'evento', 'riunione', 'the', 'an', 'of', 'to', 'with', 'for', 'and', 'at', 'on', 'meeting', 'event', 'my']);
  const toks = (x: string) => norm(x).replace(/[^a-z0-9' ]/g, ' ').split(' ').filter((w) => w.length > 1 && !stop.has(w));
  const q = toks(query), t = toks(title);
  if (!q.length || !t.length) return 0;
  const hit = q.filter((w) => t.some((x) => x === w || (w.length > 3 && x.startsWith(w.slice(0, 4))) || (x.length > 3 && w.startsWith(x.slice(0, 4))))).length;
  return hit / Math.max(q.length, t.length) * 0.5 + hit / q.length * 0.5;
}

export function bestMatch<T>(query: string, items: T[], title: (x: T) => string, min = 0.34): T | null {
  let best: T | null = null, bs = 0;
  items.forEach((x) => { const sc = similarity(query, title(x)); if (sc > bs) { bs = sc; best = x; } });
  return bs >= min ? best : null;
}

export const isYes = (s: string) => /^(si|sì|ok|okay|va bene|certo|confermo|conferma|esatto|perfetto|yes|d'accordo|procedi|fai pure|fallo|yeah|yep|yup|sure|of course|go ahead|confirm|confirmed|apply|do it|sounds good|please do|that's right|thats right|exactly|alright|correct)\b/.test(norm(s));
export const isNo = (s: string) => /^(no|non|niente|lascia stare|lascia perdere|annulla|stop|basta|cancel|nope|nah|never ?mind|forget it|leave it|don't|dont|do not|not now)\b/.test(norm(s));

/** "scegli tu", "decidi tu", "quando è più comodo": l'utente lascia la scelta all'algoritmo. */
export const isDelegate = (s: string) => /\b(scegli tu|decidi tu|scegli pure|scegli il momento|quando vuoi|quando preferisci|come preferisci|come vuoi|fai tu|a tua scelta|qualsiasi (ora|giorno|momento)|va bene (qualsiasi|tutto)|il prima possibile|prima possibile|quando (e|è) piu comodo|quando mi e piu comodo|secondo te|l'orario migliore|il momento migliore|dove vuoi|you choose|you pick|you decide|up to you|choose for me|pick for me|your choice|whenever|any ?time|as soon as possible|asap|whatever works|best time|when it'?s best|when it'?s convenient|when convenient|i don'?t mind)\b/.test(norm(s));

export type Intent =
  | 'undo' | 'event.add' | 'event.move' | 'event.delete' | 'event.rename' | 'agenda.show' | 'agenda.free' | 'agenda.share'
  | 'task.add' | 'task.done' | 'task.delete' | 'task.rename' | 'task.list' | 'note.add' | 'goal.add'
  | 'mood.log' | 'mood.analysis' | 'profile.photo' | 'profile.private' | 'profile.public'
  | 'finance.report' | 'health.report' | 'theme.dark' | 'theme.light' | 'hours.set' | 'notif.on' | 'notif.off' | 'open' | 'help' | 'plan.fill' | 'plan.reschedule' | 'event.recurring' | 'event.when' | 'task.due' | 'briefing' | 'task.next' | 'task.urgent' | 'event.important' | 'unknown';

const R = (s: RegExp) => s;
const WD_EN = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const rules: { intent: Intent; test: RegExp; en?: RegExp; w?: number }[] = [
  { intent: 'undo', test: R(/^(annulla|disfa|torna indietro|ripristina|annulla l'ultima|annulla tutto)\b|\bannulla (l'ultim|quello)/), en: R(/^(undo|revert|take (that|it) back|go back|cancel( that| it| the last( one)?)?)$|^undo\b|^cancel (that|it|the last)\b/), w: 5 },
  { intent: 'profile.photo', test: R(/\b(cambia|modifica|imposta|aggiorna|metti|carica|nuova)\b.*\b(foto|immagine)\b.*\b(profilo|avatar)\b|\b(foto|immagine) (del )?profilo\b/), en: R(/\bprofile (photo|picture|pic|image)\b|\b(change|update|set|upload|new)\b.*\b(avatar|profile pic\w*)\b/), w: 5 },
  { intent: 'profile.private', test: R(/(?=.*\b(profilo|account)\b)(?=.*\bprivat[oa]\b)\b(rendi|imposta|metti|voglio|fai|settalo)\b|\bprofilo privato\b|\bnascondi (il )?(mio )?profilo\b/), en: R(/\b(profile|account)\b.*\bprivate\b|\bprivate (profile|account)\b|\bhide my profile\b/), w: 5 },
  { intent: 'profile.public', test: R(/(?=.*\b(profilo|account)\b)(?=.*\bpubblic[oa]\b)\b(rendi|imposta|metti|voglio|fai)\b|\bprofilo pubblico\b/), en: R(/\b(profile|account)\b.*\bpublic\b|\bpublic (profile|account)\b/), w: 5 },
  { intent: 'finance.report', test: R(/\b(analisi|situazione|report|riepilogo|resoconto|come sto|come sono messo|come vanno|quanto ho (speso|risparmiato)|dettagli)\b.*\b(finanz|spese|soldi|budget|conto|risparmi)\w*|\b(finanz\w*|spese|budget)\b.*\b(analisi|dettagliat\w*|situazione|riepilogo)\b/), en: R(/\b(analysis|analyse|analyze|report|summary|overview|breakdown|review|status)\b.*\b(financ\w*|spending|expenses|money|budget|savings)\b|\b(financ\w*|spending|expenses|budget)\b.*\b(analysis|report|summary|overview|breakdown)\b|\bhow am i (doing|going) (with|on) (my )?(money|budget|spending|finances)\b|\bhow are my (finances|expenses|spending|savings)\b/), w: 4 },
  { intent: 'health.report', test: R(/\b(come ho dormito|come sto di salute|riepilogo salute|analisi (della )?salute|come vanno i miei dati|come sono i miei dati)\b|\b(sonno|passi|salute)\b.*\b(oggi|ieri|settimana|analisi)\b/), en: R(/\bhow (did|have) i (sleep|slept)\b|\bhow('s| is) my (health|sleep)\b|\bhealth (summary|report|overview|analysis)\b|\b(sleep|steps|health)\b.*\b(today|yesterday|this week|analysis)\b|\bhow many steps\b/), w: 3 },
  { intent: 'mood.analysis', test: R(/\b(analisi|come vanno|come e|com'e|andamento|grafico)\b.*\bumore\b|\bil mio umore\b.*\b(ultimi|settimana|mese|meteo|pioggia)\b/), en: R(/\bmood\b.*\b(analysis|trend|chart|graph|lately|this week|this month|weather|rain)\b|\b(analysis|analyse|analyze|trend|chart|graph)\b.*\bmood\b|\bhow('s| is| has) my mood\b/), w: 4 },
  { intent: 'mood.log', test: R(/\b(mi sento|sono|oggi sono|oggi mi sento)\b.*\b(felice|contento|calmo|sereno|neutro|stressato|triste|arrabbiato|nervoso|stanco|giu)\b/), en: R(/\b(i feel|i am|i'm|im|feeling|today i am|today i feel)\b.*\b(happy|content|calm|serene|neutral|stressed|sad|angry|nervous|tired|down|anxious|upset|great)\b/), w: 4 },
  { intent: 'agenda.show', test: R(/\b(cosa|che cosa|che)\b (ho|c'e|devo fare|faccio)\b.*\b(oggi|domani|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|settimana)\b/), en: R(new RegExp(`^(?!.*\\b(tasks?|to-?dos?|to do)\\b)(?=.*\\b(what|what's|whats)\\b).*\\b(do i have|have i got|am i doing|is on|on my (agenda|calendar|schedule|plate)|going on|is planned)\\b.*\\b(today|tomorrow|tonight|${WD_EN}|this week|next week|the day after tomorrow)\\b`)), w: 4 },
  { intent: 'finance.report', test: R(/\bquanto (ho )?(speso|spendo|guadagnato|risparmiato|sto spendendo)\b/), en: R(/\bhow much\b.*\b(spent|spend|saved|earned|spending)\b/), w: 5 },
  { intent: 'event.add', test: R(/\bho (il|la|un|una|lo)\b.*\b(alle|ore)\b\s*\d/), en: R(/\bi have (a|an|the)\b.*\b(at|@)\s*\d/), w: 3 },
  { intent: 'plan.reschedule', test: R(/\b(ripianifica|ripianificare|riorganizza|recupera|rimetti)\b.*\b(saltat\w+|persi\w*|non fatt\w+|sessioni|task|impegni|lavoro)\b|^ripianific\w*( tutto)?$/), en: R(/\b(reschedule|rebook|catch up on|re-?plan)\b.*\b(skipped|missed|sessions|overdue|unfinished)\b|^(reschedule|re-?plan)( everything| all)?$/), w: 7 },
  { intent: 'briefing', test: R(/\b(briefing|riepilogo (della giornata|di oggi|serale|del mattino)|com'e la mia giornata|cosa mi aspetta oggi|resoconto della giornata|programma di oggi)\b|^buongiorno$|^buonasera$/), en: R(/\b(briefing|daily (summary|recap|brief)|day recap|summary of (the|my) day|how('s| is) my day|what('s| is) ahead today|what awaits me today|today's (plan|schedule|summary))\b/), w: 6 },
  { intent: 'event.recurring', test: R(/\b(ogni|tutti i|tutte le)\s+(giorno|giorni|settimana|settimane|sera|mattina|pomeriggio|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/), en: R(new RegExp(`\\bevery\\s+(day|week|evening|morning|afternoon|night|weekday|${WD_EN})\\b|\\b(daily|weekly)\\b(?! (summary|recap|brief|report))`)), w: 7 },
  { intent: 'event.when', test: R(/\ba che ora\b|\bquando (e|ho|c'e)\b.*\b(riunione|call|appuntamento|visita|cena|pranzo|allenamento|meeting|incontro)\b/), en: R(/\bwhat time (is|'s)\b|\bwhat time do i have\b|\bwhen (is|'s|do i have) (my |the |our )?\w*\s?(meeting|call|appointment|visit|dinner|lunch|workout|event|dentist|session)\b/), w: 4 },
  { intent: 'task.due', test: R(/\b(scadenza|scade|scadra)\b/), en: R(/\bdeadline\b|\b(is|are|it's|its) due\b|\bdue (on|by|date|today|tomorrow|next|this)\b|\bset (a |the )?due\b/), w: 4 },
  { intent: 'plan.fill', test: R(/\b(pianifica|pianificami|organizza|organizzami|riempi|riempimi|programma|programmami|sistema|sistemami)\b.*\b(tutto|il mese|questo mese|mese|la settimana|settimana|la giornata|giornata|il piano|oggi|domani)\b|^organizz\w+$|^pianific\w+$/), en: R(/\b(plan|organi[sz]e|arrange|fill( up)?)\b (out )?(for me )?(my |the |this |next )?(whole |entire )?(month|week|day|schedule|calendar|everything)\b|^(plan|organi[sz]e) (for )?(today|tomorrow)$|^(plan|organi[sz]e) (it|everything|for me)$/), w: 6 },
  { intent: 'task.next', test: R(/\b(cosa|che cosa|quale|qual e|dimmi)\b.*\b(devo|dovrei|faccio|posso|conviene|fare)\b.*\b(adesso|ora|prima|subito|oggi)\b|\b(quale|prossim[oa]|piu urgente|priorita)\b.*\b(task|compito|cosa|attivita|fare)\b|\bda dove (parto|comincio|inizio)\b|^cosa (devo|faccio) fare\b/), en: R(/\bwhat (should|do|can|shall) i (do|work on|tackle|focus on|start with)\b|\bwhat('s| is) (next|my (next|top) (task|priority))\b|\bwhere (do|should) i (start|begin)\b|\bnext task\b|\bmost urgent\b|\bmy priorit(y|ies)\b|\bwhat now\b/), w: 5 },
  { intent: 'task.urgent', test: R(/\b(segna|metti|imposta|rendi|marca)\b.*\b(urgent[ei])\b|\burgent[ei]\b.*\b(task|compito)\b|^urgente:/), en: R(/\b(mark|set|make|flag|put)\b.*\burgent\b|\burgent\b.*\btask\b|^urgent:/), w: 5 },
  { intent: 'event.important', test: R(/\b(segna|metti|imposta|rendi|marca)\b.*\b(important[ei])\b/), en: R(/\b(mark|set|make|flag)\b.*\bimportant\b/), w: 5 },
  { intent: 'agenda.share', test: R(/\b(condividi|condividimi|manda|invia|mostra)\b.*\b(agenda|impegni|disponibilita|slot|calendario)\b/), en: R(/\b(share|send)\b.*\b(agenda|schedule|calendar|availability|free (slots|time))\b|\bshow\b.*\b(agenda|schedule|calendar|availability)\b.*\b(to|with)\b/), w: 4 },
  { intent: 'agenda.free', test: R(/\b(quando sono libero|slot liber\w+|sono libero|ho tempo|buchi|disponibil\w+|quando posso|quando ho tempo)\b/), en: R(/\b(when am i free|when (can|could) i|when do i have (time|a gap)|free (slots|time|spots)|am i free|my availability|any free|open slots|gaps)\b/), w: 4 },
  { intent: 'agenda.show', test: R(/\b(che|quali|cosa|quanti|mostra|dimmi|elenco|lista)\b.*\b(impegni|appuntamenti|programma|ho in agenda|agenda|piano|riunioni)\b|\b(il mio|nel) (piano|programma|calendario)\b.*\b(oggi|domani|settimana|dopodomani)\b/), en: R(/^(?!.*\b(tasks?|to-?dos?)\b).*\b(what|which|how many|show|tell|list|give)\b.*\b(appointments|events|meetings|schedule|agenda|plan|calendar)\b|\bdo i have anything\b|\bwhat do i have\b/), w: 3 },
  { intent: 'event.move', test: R(/\b(sposta|spostare|rimanda|rimandare|anticipa|posticipa|riprogramma)(l[aoei])?\b|\bcambia (l')?(orario|giorno|data|ora)\b/), en: R(/\b(move|reschedule|postpone|bring forward|shift|delay)\b|\bpush (it |the \w+ )?(back|to|until|forward)\b|\bchange (the )?(time|day|date)\b/), w: 4 },
  { intent: 'event.delete', test: R(/\b(cancella|elimina|togli|rimuovi|disdici|annulla)\b.*\b(impegno|evento|appuntamento|riunione|dal piano|dal calendario|dall'agenda|meeting|allenamento)\b|\b(cancella|elimina|rimuovi|disdici)(l[aoei])\b(?!.*\b(task|attivita)\b)/), en: R(/^(?!.*\b(tasks?|to-?dos?)\b).*\b(cancel|delete|remove|drop|scrap)\b.*\b(meeting|event|appointment|call|workout|session|dinner|lunch|visit|from (the |my )?(plan|calendar|agenda|schedule))\b|^(delete|remove|cancel) (it|that|this)$/), w: 4 },
  { intent: 'event.rename', test: R(/\b(rinomina|cambia (il )?(nome|titolo))\b.*\b(impegno|evento|appuntamento|riunione)\b/), en: R(/\b(rename|change (the )?(name|title) of)\b.*\b(meeting|event|appointment|call)\b/), w: 4 },
  { intent: 'task.done', test: R(/\b(ho (fatto|finito|completato|concluso)|completa|completato|segna (come )?(fatto|completat\w+|finit\w+)|spunta|e fatto|fatto il task)\b/), en: R(/\bi('ve| have)? (just )?(done|finished|completed)\b|\b(mark|set)\b.*\b(as )?(done|complete|completed|finished)\b|\b(tick|check|cross) off\b|\bcomplete (the )?task\b|\b(is|it's|its) done\b/), w: 4 },
  { intent: 'task.delete', test: R(/\b(cancella|elimina|togli|rimuovi)\b.*\b(task|attivita|cosa da fare|to-?do)\b/), en: R(/\b(delete|remove|drop|scrap)\b.*\b(task|to-?do|todo)\b/), w: 4 },
  { intent: 'task.rename', test: R(/\b(rinomina|cambia (il )?(nome|titolo))\b.*\b(task|attivita)\b/), en: R(/\brename\b.*\btask\b/), w: 4 },
  { intent: 'task.list', test: R(/\b(quali|che|mostra|elenco|lista|dimmi|quanti)\b.*\b(task|attivita|cose da fare|to-?do)\b/), en: R(/\b(what|which|show|list|tell|how many)\b.*\b(tasks|to-?dos?|things to do)\b|\bmy (tasks|to-?do list)\b|\bwhat do i (need|have) to do\b/), w: 3 },
  { intent: 'task.add', test: R(/\b(aggiungi|aggiungimi|crea|creami|nuovo|nuova|metti|segna|inserisci)\b.*\b(task|attivita|cosa da fare|to-?do)\b|\b(task|attivita)\b.*\b(nuov[oa]|da aggiungere)\b|^(devo|bisogna|ricordami di|ricordati di)\b/), en: R(/\b(add|create|new|put|insert|make)\b.*\b(task|to-?do|todo)\b|\btask\b.*\bto add\b|^(i need to|i have to|i must|i should|remind me to|don't forget to|dont forget to|need to|todo:?)\b/), w: 3 },
  { intent: 'note.add', test: R(/\b(scrivi|crea|salva|aggiungi|prendi|annota)\b.*\b(nota|appunto|memo)\b|^nota:/), en: R(/\b(write|create|save|add|take|make|jot)\b.*\b(note|memo)\b|^note:/), w: 4 },
  { intent: 'goal.add', test: R(/\b(nuovo obiettivo|aggiungi (un )?obiettivo|crea (un )?obiettivo|imposta (un )?obiettivo)\b/), en: R(/\b(new goal|add (a )?goal|create (a )?goal|set (a )?goal)\b/), w: 4 },
  { intent: 'event.add', test: R(/\b(metti|mettimi|inserisci|segna|segnami|fissa|fissami|aggiungi|prenota)\b.*\b(oggi|domani|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b.*\b(alle|ore|a)\b\s*\d|\b(metti|mettimi|inserisci|segna|segnami|fissa|fissami)\b.*\b(alle|ore)\b\s*\d/), en: R(new RegExp(`\\b(add|put|schedule|book|block|set up|fix|arrange)\\b.*\\b(today|tomorrow|${WD_EN})\\b.*\\bat\\b\\s*\\d|\\b(add|put|schedule|book|block|set up|arrange)\\b.*\\bat\\s*\\d`)), w: 3 },
  { intent: 'event.add', test: R(/\b(aggiungi|aggiungimi|metti|mettimi|inserisci|segna|segnami|programma|pianifica|fissa|fissami|prenota|crea|creami|organizza)\b.*\b(piano|calendario|agenda|impegno|evento|appuntamento|riunione|meeting|call|allenamento|visita|cena|pranzo)\b|\b(riunione|meeting|call|appuntamento|visita|cena|pranzo|allenamento)\b.*\b(domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|alle|ore)\b|\bnel mio piano\b|\bal piano\b/), en: R(new RegExp(`\\b(add|put|schedule|book|set up|create|plan|insert|block|arrange)\\b.*\\b(plan|calendar|agenda|schedule|event|appointment|meeting|call|workout|visit|dinner|lunch|reminder)\\b|\\b(meeting|call|appointment|visit|dinner|lunch|workout)\\b.*\\b(tomorrow|today|${WD_EN}|at)\\b|\\bto (my |the )?(plan|calendar|agenda|schedule)\\b`)), w: 3 },
  { intent: 'theme.dark', test: R(/\b(modalita|tema)\b.*\b(scur[oa]|dark|notte)\b|\bmetti (il )?(tema )?scuro\b/), en: R(/\b(dark|night) (mode|theme)\b|\b(switch|turn|set|change)\b.*\bto dark\b/), w: 4 },
  { intent: 'theme.light', test: R(/\b(modalita|tema)\b.*\b(chiar[oa]|light|giorno)\b|\bmetti (il )?(tema )?chiaro\b/), en: R(/\b(light|day) (mode|theme)\b|\b(switch|turn|set|change)\b.*\bto light\b/), w: 4 },
  { intent: 'hours.set', test: R(/\b(orario|orari) di lavoro\b|\blavoro dalle\b/), en: R(/\b(work(ing)?|office) hours\b|\bi work from\b/), w: 4 },
  { intent: 'notif.on', test: R(/\b(attiva|abilita|accendi)\b.*\bnotific\w+/), en: R(/\b(turn on|enable|activate|switch on|allow)\b.*\bnotifications?\b/), w: 4 },
  { intent: 'notif.off', test: R(/\b(disattiva|spegni|blocca)\b.*\bnotific\w+/), en: R(/\b(turn off|disable|deactivate|switch off|mute|stop|block)\b.*\bnotifications?\b/), w: 4 },
  { intent: 'open', test: R(/^(apri|vai (a|al|alla|allo|alle|agli|ai|su|in)|portami (a|in|su)|mostrami)\b/), en: R(/^(open|go to|go into|take me to|navigate to|bring me to|launch)\b|^show me (the |my )?(home|dashboard|plan|calendar|tasks|notes|drive|health|finance|finances|travel|network|profile|settings|mood|messages|notifications|stocks|portfolio|taxes|forecast|chat)\b/), w: 5 },
  { intent: 'help', test: R(/\b(aiuto|cosa sai fare|cosa puoi fare|che cosa fai|comandi|esempi|come funzioni)\b/), en: R(/\b(help|what can you do|what do you do|commands|examples|how do you work|how does this work)\b/), w: 2 },
];

/** Sceglie l'intento con il punteggio più alto (a parità vince la regola più specifica, cioè più in alto nell'elenco). */
export function detectIntent(raw: string): Intent {
  const s = norm(raw);
  let best: Intent = 'unknown', bw = 0;
  for (const r of rules) if ((r.test.test(s) || (r.en && r.en.test(s))) && (r.w ?? 1) > bw) { best = r.intent; bw = r.w ?? 1; }
  return best;
}

export const pageNames: Record<string, string> = {
  home: 'home', dashboard: 'home', piano: 'plan', plan: 'plan', calendario: 'plan', calendar: 'plan', task: 'lifetask', tasks: 'lifetask', todo: 'lifetask', note: 'lifenotes', notes: 'lifenotes', drive: 'lifedrive', salute: 'lifehealth', health: 'lifehealth', finanze: 'lifefinance', finanza: 'lifefinance', finance: 'lifefinance', finances: 'lifefinance',
  viaggi: 'lifetravel', travel: 'lifetravel', trips: 'lifetravel', network: 'lifenetwork', lavoro: 'lifenetwork', work: 'lifenetwork', jobs: 'lifenetwork', community: 'lifenetwork', profilo: 'profile', profile: 'profile', impostazioni: 'settings', settings: 'settings', umore: 'mood', mood: 'mood', messaggi: 'messagesPage', messages: 'messagesPage', notifiche: 'notificationsPage', notifications: 'notificationsPage', lifepoints: 'lifepointsPage', azioni: 'stocks', stocks: 'stocks', portafoglio: 'portfolio', portfolio: 'portfolio', tasse: 'taxdecl', taxes: 'taxdecl', tax: 'taxdecl', fiscale: 'taxdecl', previsioni: 'lifeforecast', forecast: 'lifeforecast', chat: 'ai',
};

export const topicKeywords: Record<string, string[]> = {
  Finanze: ['soldi', 'budget', 'spese', 'spesa', 'risparmio', 'risparmi', 'banca', 'conto', 'investimento', 'investire', 'bolletta', 'bollette', 'stipendio', 'tasse', 'fiscale', 'finanze', 'finanza', 'azioni', 'mutuo', 'cassa malati', 'entrate', 'uscite', 'money', 'spending', 'expenses', 'savings', 'bank', 'account', 'investment', 'invest', 'bills', 'salary', 'taxes', 'finance', 'finances', 'stocks', 'mortgage', 'income'],
  Salute: ['salute', 'medico', 'dottore', 'sonno', 'dormire', 'dormito', 'dolore', 'visita', 'farmaco', 'analisi', 'sintomo', 'battito', 'passi', 'peso', 'dieta', 'hrv', 'health', 'doctor', 'sleep', 'slept', 'pain', 'medicine', 'symptoms', 'heart rate', 'steps', 'weight', 'diet'],
  Fitness: ['allenamento', 'palestra', 'corsa', 'correre', 'muscoli', 'workout', 'sport', 'yoga', 'nuoto', 'bici', 'workout', 'gym', 'running', 'muscles', 'swimming', 'cycling', 'exercise'],
  Mente: ['umore', 'ansia', 'stress', 'meditazione', 'mindfulness', 'emozioni', 'mente', 'triste', 'felice', 'stressato', 'mood', 'anxiety', 'meditation', 'emotions', 'mind', 'sad', 'happy', 'stressed'],
  Lavoro: ['lavoro', 'azienda', 'cliente', 'clienti', 'vendite', 'meeting', 'riunione', 'fatturato', 'investitori', 'marketing', 'startup', 'soci', 'colloquio', 'candidati', 'progetto', 'work', 'company', 'clients', 'sales', 'revenue', 'investors', 'interview', 'candidates', 'project'],
  Studio: ['studio', 'esame', 'tedesco', 'lezione', 'corso', 'libro', 'universita', 'imparare', 'inglese', 'francese', 'lingua', 'study', 'exam', 'german', 'lesson', 'course', 'university', 'learn', 'english', 'french', 'language'],
  Viaggi: ['viaggio', 'volo', 'hotel', 'vacanza', 'aeroporto', 'valigia', 'itinerario', 'destinazione', 'trip', 'flight', 'vacation', 'airport', 'luggage', 'itinerary', 'travel', 'destination'],
  Casa: ['casa', 'affitto', 'trasloco', 'pulizie', 'mobili', 'elettricista', 'bollette', 'home', 'rent', 'moving', 'cleaning', 'furniture', 'electrician'],
  Legale: ['contratto', 'avvocato', 'causa', 'legale', 'diritto', 'firma', 'privacy', 'contract', 'lawyer', 'legal', 'law', 'signature'],
  Musica: ['musica', 'canzone', 'canzoni', 'chitarra', 'piano', 'concerto', 'album', 'spotify', 'playlist', 'cantare', 'band', 'traccia', 'suonare', 'beat', 'music', 'song', 'songs', 'guitar', 'concert', 'sing', 'track'],
  Arte: ['arte', 'disegno', 'disegnare', 'pittura', 'dipingere', 'museo', 'mostra', 'fotografia', 'scultura', 'design', 'illustrazione', 'quadro', 'art', 'drawing', 'painting', 'museum', 'photography', 'sculpture', 'illustration'],
  Cucina: ['cucina', 'ricetta', 'ricette', 'cucinare', 'cena', 'pranzo', 'ingredienti', 'dolce', 'pasta', 'forno', 'cooking', 'recipe', 'recipes', 'dinner', 'lunch', 'ingredients', 'dessert', 'oven'],
  Cinema: ['film', 'serie', 'cinema', 'netflix', 'regista', 'attore', 'documentario', 'movie', 'movies', 'director', 'actor'],
  Tecnologia: ['codice', 'programmare', 'app', 'software', 'computer', 'telefono', 'internet', 'ai', 'intelligenza artificiale', 'server', 'programming', 'computer', 'phone', 'artificial intelligence'],
  Piano: ['piano', 'agenda', 'calendario', 'impegni', 'impegno', 'appuntamento', 'task', 'obiettivo', 'obiettivi', 'scadenza', 'schedule', 'appointment', 'appointments', 'tasks', 'goal', 'goals', 'deadline'],
};

/** Argomento di una frase per parole chiave (null se nessuna). */
export function topicOf(raw: string): string | null {
  const s = ' ' + norm(raw).replace(/[^a-z0-9' ]/g, ' ') + ' ';
  let best: string | null = null, bs = 0;
  for (const [t, ws] of Object.entries(topicKeywords)) {
    const sc = ws.reduce((a, w) => a + (s.includes(' ' + norm(w) + ' ') || (w.length > 4 && s.includes(' ' + norm(w))) ? 1 : 0), 0);
    if (sc > bs) { bs = sc; best = t; }
  }
  return best;
}
