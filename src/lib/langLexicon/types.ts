import type { Script } from './fold.ts';

export type LexCode = 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'hi' | 'ar' | 'ru' | 'ja' | 'id';
export type SupportedLang = LexCode | 'it' | 'en';

/**
 * Dati di una lingua. Le stringhe sono SORGENTI di espressioni regolari:
 *  - le parole si scrivono naturali (con accenti): vengono piegate come il testo;
 *  - uno spazio = uno o più spazi; `*` = qualunque terminazione della parola (es. `elimin*`);
 *  - macro: {num} numeri, {wd} giorni della settimana (gruppi w0..w6, 0 = domenica), {mo} mesi (gruppi mo0..mo11);
 *  - gruppi con nome nei modelli di data/ora: h m half qa qb hb ap | h1 m1 ap1 h2 m2 ap2 | n u | d mn | p.
 */
export type LexData = {
  code: LexCode;
  script: Script;
  /** true se le parole sono separate da spazi (false: cinese, giapponese) */
  spaced: boolean;
  /** parole-numero (1..30...) con il loro valore */
  nums: Record<string, number>;
  today: string; tomorrow: string; dayafter: string; yesterday: string;
  /** domenica, lunedì, ... sabato */
  weekdays: [string, string, string, string, string, string, string];
  months: [string, string, string, string, string, string, string, string, string, string, string, string];
  nextweek: string; thisweek: string;
  /** "ogni / every" */
  every: string;
  /** "ogni giorno": parola per giorno e per settimana dopo `every` */
  dayWord: string; weekWord: string;
  /** "tra N giorni" (gruppi n,u) e classificazione dell'unità */
  inN: string[];
  unitDay: string; unitWeek: string; unitMonth: string;
  /** date: "12 ottobre" (d + mo0..11) oppure "10月12日" (mn + d) */
  dates: string[];
  /** orari (h,m,half,qa,qb,hb,ap) */
  time: string[];
  /** intervalli (h1,m1,ap1,h2,m2,ap2) */
  range: string[];
  /** durate (n,u) e classificazione ore/minuti; `half` = mezz'ora, `one` = un'ora */
  dur: string[];
  unitHour: string; unitMin: string;
  halfHour: string; oneHour: string;
  pm: string; am: string;
  noon: string; midnight: string;
  hintMorning: string; hintAfternoon: string; hintEvening: string;
  /** concetti dei comandi (vedi rules.ts) */
  c: Partial<Record<Concept, string>>;
  /** pagine per "apri ..." */
  pages: Partial<Record<Page, string>>;
  /** stati d'animo */
  moods: Partial<Record<Mood, string>>;
  /** persona a cui condividere l'agenda (gruppo p) */
  withP: string;
  /** parole funzionali da togliere solo ai bordi del titolo (articoli, preposizioni) */
  edge: string;
  /** virgolette che racchiudono un titolo, oltre alle comuni */
  quotes?: string;
};

export type Concept =
  | 'polite' | 'add' | 'del' | 'move' | 'done' | 'show' | 'open' | 'rename' | 'share' | 'mark' | 'plan' | 'write' | 'on' | 'off'
  | 'undo' | 'task' | 'event' | 'cal' | 'note' | 'goal' | 'mood' | 'finance' | 'health' | 'sleepQ' | 'free' | 'notif' | 'profile'
  | 'priv' | 'pub' | 'photo' | 'dark' | 'light' | 'themeN' | 'month' | 'week' | 'dayN' | 'urgent' | 'important' | 'spent'
  | 'nowQ' | 'qHave' | 'qWhen' | 'due' | 'workhours' | 'briefing' | 'resched' | 'feel' | 'into'
  | 'yes' | 'no' | 'choose' | 'apply' | 'keepboth' | 'help' | 'hello' | 'thanks';

export type Page = 'home' | 'plan' | 'tasks' | 'notes' | 'drive' | 'health' | 'finance' | 'travel' | 'network' | 'profile' | 'settings' | 'mood' | 'messages' | 'notifications' | 'stocks' | 'portfolio' | 'taxes' | 'forecast' | 'chat';
export type Mood = 'happy' | 'calm' | 'neutral' | 'stressed' | 'sad' | 'tired' | 'angry';

/** Esito della comprensione. */
export type Understood =
  /** italiano o inglese (o testo che l'assistente locale già capisce): passa com'è */
  | { status: 'passthrough'; text: string; lang: string }
  /** tradotto in un comando canonico inglese che l'assistente esegue senza modifiche */
  | { status: 'translated'; text: string; lang: string; intent: string; confidence: number }
  /** capito solo in parte: va chiesta conferma all'utente con il comando proposto */
  | { status: 'confirm'; text: string; lang: string; intent: string; confidence: number }
  /** non capito: niente indovinelli (si può inoltrare all'AI quando sarà collegata) */
  | { status: 'unknown'; lang: string };
