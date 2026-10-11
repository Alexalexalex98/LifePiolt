/**
 * Analisi LOCALE del testo di una bolletta o fattura (it, de, fr, en). Puro: nessun import di react-native,
 * nessuna rete, nessuna AI. Ogni campo ha una confidenza e la riga di origine, cosi' l'utente puo' controllare.
 * Non inserisce nulla da solo: restituisce una bozza da confermare.
 */
import { t } from '../../i18n/core.ts';
import { checkIban, checkPagoPa, checkQrr, checkScor, compact, formatIban, formatPagoPa, formatQrr } from './checks.ts';
import { addDays, diffDays, isIso, mkIso, validYmd } from './dates.ts';
import type { BillDraft, BillKind, BillLang, Confidence, Field, Recurrence } from './types.ts';

export type ParseOptions = {
  /** Oggi (ISO), per dedurre l'anno delle date senza anno e per le segnalazioni. */
  today?: string;
  /** Valuta da usare solo se nel documento non se ne vede nessuna (resta con confidenza bassa). */
  defaultCurrency?: string;
  /** Ordine delle date numeriche con '/' quando e' ambiguo: dal locale dell'utente. */
  dateOrder?: 'dmy' | 'mdy';
  fileName?: string;
};

// ---------------------------------------------------------------- utilita' sul testo

/** Minuscole senza accenti, carattere per carattere (la lunghezza non cambia: gli indici restano allineati). */
const FOLD_CACHE = new Map<string, string>();
function foldChar(c: string): string {
  let r = FOLD_CACHE.get(c);
  if (r === undefined) {
    if (c === 'ß') r = 's';
    else { const d = c.normalize('NFD'); r = (d.length ? d[0] : c).toLowerCase(); if (r.length !== 1) r = c.toLowerCase().slice(0, 1) || c; }
    FOLD_CACHE.set(c, r);
  }
  return r;
}
export function fold(s: string): string {
  let o = '';
  for (let i = 0; i < s.length; i++) o += foldChar(s[i]);
  return o;
}

export function normalizeText(raw: string): string {
  return raw
    .replace(/\u0000/g, ' ')
    .replace(/[    ]/g, ' ')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/\t/g, '  ')
    .replace(/[ ]{3,}/g, '  ')
    .replace(/\r\n?/g, '\n');
}

const snippet = (line: string, start: number, end: number) => {
  const l = line.trim();
  if (l.length <= 120) return l;
  const a = Math.max(0, start - 50), b = Math.min(line.length, end + 50);
  return (a > 0 ? '… ' : '') + line.slice(a, b).trim() + (b < line.length ? ' …' : '');
};
const blankSpan = (s: string, a: number, b: number) => s.slice(0, a) + ' '.repeat(b - a) + s.slice(b);

// ---------------------------------------------------------------- lingua

const LANG_WORDS: Record<Exclude<BillLang, '?'>, RegExp[]> = {
  it: [/fattura/, /scadenza/, /importo/, /totale/, /pagamento/, /bolletta/, /cliente/, /entro il/, /codice/, /iva\b/, /\bdel\b/, /euro/, /periodo/, /fornitura/],
  de: [/rechnung/, /betrag/, /fallig/, /zahlbar/, /datum/, /kunde/, /mwst/, /zahlung/, /\bund\b/, /strasse/, /konto/, /referenz/, /zu zahlen/],
  fr: [/facture/, /montant/, /echeance/, /paiement/, /client/, /\btva\b/, /\bdate\b/, /\bde la\b/, /a payer/, /reference/, /\bdu\b/, /payable/],
  en: [/invoice/, /amount/, /\bdue\b/, /payment/, /customer/, /\btotal\b/, /\bvat\b/, /\bthe\b/, /please/, /account/, /\bbill\b/, /\bpay\b/],
};
export function detectLang(folded: string): BillLang {
  let best: BillLang = '?', top = 1;
  (Object.keys(LANG_WORDS) as Exclude<BillLang, '?'>[]).forEach((k) => {
    const n = LANG_WORDS[k].reduce((s, re) => s + (re.test(folded) ? 1 : 0), 0);
    if (n > top) { top = n; best = k; }
  });
  return best;
}

// ---------------------------------------------------------------- importi

type Amt = { value: number; line: number; start: number; end: number; raw: string; cur?: string; score: number; ambiguous?: boolean; decimals: boolean };

const CUR = "(?:\\b(?:CHF|EUR|USD|GBP|SFr|Fr)\\.?|[€$£])";
const NUM = "(?:\\d{1,3}(?:[.,'\\u2019]\\d{3})+(?:[.,]\\d{1,2}|[.,]-)?|\\d{1,3}(?: \\d{3})+[.,]\\d{2}|\\d+(?:[.,]\\d{1,2}|[.,]-)?)";
const AMT_RE = () => new RegExp(`(${CUR})?\\s*(-?${NUM})(?![\\d]|[.,]\\d)(?:\\s*(${CUR})(?![A-Za-z]))?`, 'gi');

function curCode(c?: string): string | undefined {
  if (!c) return undefined;
  const u = c.replace('.', '').toUpperCase();
  if (u === 'CHF' || u === 'SFR' || u === 'FR') return 'CHF';
  if (u === '€' || u === 'EUR') return 'EUR';
  if (u === '$' || u === 'USD') return 'USD';
  if (u === '£' || u === 'GBP') return 'GBP';
  return undefined;
}

/** Converte "1.234,56", "1'234.56", "84,50", "1,234.56" in numero. `ambiguous` se "1.234" / "1,234" potrebbero essere decimali. */
export function parseAmount(str: string): { value: number; ambiguous: boolean } | null {
  let s = str.replace(/[\s\u00a0]/g, '').replace(/['\u2019]/g, '').replace(/([.,])-$/, '$100');
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length, commas = (s.match(/,/g) ?? []).length;
  let ambiguous = false;
  let num: string;
  if (dots && commas) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const th = dec === '.' ? ',' : '.';
    if ((s.match(new RegExp('\\' + dec, 'g')) ?? []).length > 1) return null;
    num = s.split(th).join('').replace(dec, '.');
  } else if (dots > 1 || commas > 1) {
    const sep = dots > 1 ? '.' : ',';
    if (!new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(s)) return null;
    num = s.split(sep).join('');
  } else if (dots === 1 || commas === 1) {
    const sep = dots ? '.' : ',';
    const [a, b] = s.split(sep);
    if (b.length === 3 && a.length <= 3 && a !== '0') { num = a + b; ambiguous = true; } // 1.234 -> 1234
    else if (b.length <= 2) num = a + '.' + b;
    else return null;
  } else num = s;
  const v = Math.round(parseFloat(num) * 100) / 100;
  if (!Number.isFinite(v)) return null;
  return { value: neg ? -v : v, ambiguous };
}

const AMT_TOP = /(totale da pagare|importo da pagare|totale da versare|somma da pagare|saldo da pagare|importo dovuto|totale dovuto|da pagare|importo del bollettino|total amount due|amount due|total due|balance due|total to pay|amount payable|total payable|please pay|pay this amount|zu zahlen|zahlbetrag|zu bezahlen|betrag zu zahlen|offener betrag|zahlungsbetrag|total zu zahlen|montant a payer|net a payer|total a payer|solde a payer|montant a regler|montant du\b)/;
const AMT_TWO = /(totale fattura|totale documento|totale complessivo|totale bolletta|importo totale|totale importo|totale generale|grand total|invoice total|total amount|amount total|rechnungsbetrag|gesamtbetrag|endbetrag|totalbetrag|fakturabetrag|rechnungstotal|montant total|total ttc|montant de la facture|total facture|totale iva|totale eur|totale chf)/;
const AMT_MID = /(totale|total|importo|betrag|montant|amount|saldo|summe|somma|gesamt|solde)/;
const AMT_NEG = /(\biva\b|mwst|\btva\b|\bvat\b|imponibile|netto|subtotale|subtotal|sconto|rabatt|remise|acconto|anticipo|gia pagato|bereits bezahlt|deja paye|already paid|pagato|credito|gutschrift|rimborso|interess|mora|zinsen|mahngeb|penale|penalit|canone|kwh|smc|\bmc\b|\bm3\b|prezzo unitario|unit price|quantita|menge|einzelpreis|prix unitaire|late fee|frais de rappel|spese di|acconti|rate residue|prossima|next)/;
const AMT_VAT_OK = /(incl|inkl|ttc|compres|inclus|comprese)/;
const QR_HEAD = /^\s*(wahrung|valuta|monnaie|currency)\b.*\b(betrag|importo|montant|amount)/;

function kwScore(f: string): number {
  let s = 0;
  if (AMT_TOP.test(f)) s += 12;
  else if (AMT_TWO.test(f)) s += 9;
  else if (AMT_MID.test(f)) s += 5;
  const neg = f.match(new RegExp(AMT_NEG.source, 'g'));
  if (neg) {
    const vatOk = AMT_VAT_OK.test(f);
    const real = neg.filter((x) => !(vatOk && /^(\biva\b|mwst|\btva\b|\bvat\b|imponibile|netto)$/.test(x)));
    s -= 8 * Math.min(2, real.length);
  }
  if (/%/.test(f)) s -= 3;
  return s;
}

// ---------------------------------------------------------------- date

const MONTHS: Record<string, number> = {
  gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6, luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, sett: 9, set: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12,
  january: 1, jan: 1, february: 2, march: 3, april: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, october: 10, oct: 10, november: 11, december: 12, dec: 12,
  januar: 1, janner: 1, februar: 2, marz: 3, mai: 5, juni: 6, juli: 7, oktober: 10, okt: 10, dezember: 12, dez: 12,
  janvier: 1, janv: 1, fevrier: 2, fevr: 2, mars: 3, avril: 4, avr: 4, juin: 6, juillet: 7, juil: 7, aout: 8, septembre: 9, octobre: 10, decembre: 12,
};
const MON_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const RE_TXT_A = () => new RegExp(`(?:^|[^\\d])(\\d{1,2})(?:st|nd|rd|th|er)?\\.?\\s*(?:of\\s+|de\\s+|d')?(${MON_ALT})\\.?(?![a-z])(?:,?\\s*(\\d{4}|\\d{2})(?!\\d))?`, 'g');
const RE_TXT_B = () => new RegExp(`(?:^|[^a-z])(${MON_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:,?\\s*(\\d{4})(?!\\d))?`, 'g');
const RE_NUM_SRC = /(?:^|[^\d])(\d{1,2})\s?([./-])\s?(\d{1,2})\s?\2\s?(\d{4}|\d{2})(?!\d)/.source;
const RE_ISO_SRC = /(?:^|[^\d])(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?!\d)/.source;

type DateHit = {
  iso: string; start: number; end: number; raw: string; kind: 'iso' | 'txt' | 'num';
  /** numerica con '/' o '-' dove entrambi i primi due numeri sono <= 12 e diversi */
  a?: number; b?: number; y?: number; sep?: string; ambiguousOrder?: boolean; alt?: string; yearless?: boolean;
};

function year4(y: string): number { return y.length === 2 ? 2000 + Number(y) : Number(y); }

/** Trova tutte le date di una riga (la riga e' gia' "fold"). L'ordine g/m dei casi numerici si risolve dopo. */
function findDates(f: string): DateHit[] {
  const out: DateHit[] = [];
  const push = (h: DateHit) => { if (!out.some((o) => h.start < o.end && o.start < h.end)) out.push(h); };
  let m: RegExpExecArray | null;
  const iso = new RegExp(RE_ISO_SRC, 'g');
  while ((m = iso.exec(f))) {
    const off = m[0].length - (m[0].replace(/^\D/, '')).length;
    const y = +m[1], mo = +m[3], d = +m[4];
    if (validYmd(y, mo, d)) push({ iso: mkIso(y, mo, d), start: m.index + off, end: m.index + m[0].length, raw: m[0].slice(off), kind: 'iso' });
  }
  const a = RE_TXT_A();
  while ((m = a.exec(f))) {
    const off = m[0].length - m[0].replace(/^\D/, '').length;
    const d = +m[1], mo = MONTHS[m[2]];
    if (!mo) continue;
    if (m[3]) { const y = year4(m[3]); if (validYmd(y, mo, d)) push({ iso: mkIso(y, mo, d), start: m.index + off, end: m.index + m[0].length, raw: m[0].slice(off), kind: 'txt' }); }
    else if (d >= 1 && d <= 31) push({ iso: `0000-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, start: m.index + off, end: m.index + m[0].length, raw: m[0].slice(off), kind: 'txt', yearless: true });
  }
  const b = RE_TXT_B();
  while ((m = b.exec(f))) {
    const off = m[0].length - m[0].replace(/^[^a-z]/, '').length;
    const mo = MONTHS[m[1]], d = +m[2];
    if (!mo) continue;
    if (m[3]) { const y = +m[3]; if (validYmd(y, mo, d)) push({ iso: mkIso(y, mo, d), start: m.index + off, end: m.index + m[0].length, raw: m[0].slice(off), kind: 'txt' }); }
  }
  const n = new RegExp(RE_NUM_SRC, 'g');
  while ((m = n.exec(f))) {
    const off = m[0].length - m[0].replace(/^\D/, '').length;
    const x = +m[1], y2 = +m[3], yy = year4(m[4]);
    const sep = m[2];
    const raw = m[0].slice(off);
    const start = m.index + off, end = m.index + m[0].length;
    if (x >= 1 && x <= 31 && y2 >= 1 && y2 <= 31 && yy >= 1990 && yy <= 2100) push({ iso: '', start, end, raw, kind: 'num', a: x, b: y2, y: yy, sep });
  }
  return out.sort((p, q) => p.start - q.start);
}

// ---------------------------------------------------------------- etichette delle date

const DUE_STRONG = /(scadenza(?! (?:del )?(?:contratto|offerta|carta|documento|tessera|polizza|promozione))|scade\b|scadra|entro il|entro e non oltre|pagare entro|pagabile entro|da pagare entro|pagamento entro|versamento entro|termine (?:di )?pagamento|data limite|zahlbar bis|zahlbar innert|zahlbar|fallig|zahlungsfrist|zahlungsziel|payable by|payable until|due date|date due|due on|due by|pay by|payment due|pay before|pay on or before|echeance|a payer avant|a regler avant|payable jusqu|avant le|jusqu'au|delai de paiement|date limite)/;
const DUE_WEAK = /(\bdue\b|\bentro\b|\bbis\b|\btermin\b|\bpayable\b)/;
const ISSUE_STRONG = /(data (?:di )?(?:fattura|emissione|documento|bolletta|fatturazione)|emess[ao] il|emissione|(?:fattura|bolletta|nota di credito|avviso)(?: n[a-z.°º]*)?[^\n]{0,24}\bdel\b|rechnungsdatum|ausstellungsdatum|belegdatum|rechnung vom|rechnungsdatum|datum der rechnung|date de (?:la )?facture|date d'emission|facture du|invoice date|date of issue|issue date|issued(?: on)?|bill date|billing date|date of invoice|invoice dated|dated)/;
const ISSUE_WEAK = /(\bdata\b|\bdatum\b|\bdate\b|\bdel\b|\bvom\b|\bam\b)/;
const PERIOD_LBL = /(periodo|period\b|abrechnungsperiode|zeitraum|periode|consumi|fornitura|billing period|leistungszeitraum|verrechnungsperiode|periode de facturation)/;
const PERIOD_GAP = /^\s*(?:al|a|-|bis|au|to|until|fino al|\/|e|et|and)\s*$/;
const PRINT_LBL = /(stamp|druck|imprime|printed|ristamp|pagina|page|seite)/;

type Cls = 'due' | 'issue' | 'period' | 'other';
type Lbl = { cls: Cls; strong: boolean; term?: string };

function classify(pre: string, post: string): Lbl {
  let best: { cls: Cls; strong: boolean; idx: number; term: string } | null = null;
  const consider = (cls: Cls, strong: boolean, re: RegExp) => {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null, last: RegExpExecArray | null = null;
    while ((m = g.exec(pre))) last = m;
    if (last) {
      const idx = last.index + last[0].length + (strong ? 25 : 0);
      if (!best || idx > best.idx) best = { cls, strong, idx, term: last[0] };
    }
  };
  consider('due', true, DUE_STRONG); consider('issue', true, ISSUE_STRONG);
  consider('due', false, DUE_WEAK); consider('issue', false, ISSUE_WEAK);
  if (PRINT_LBL.test(pre.slice(-25))) return { cls: 'other', strong: false };
  if (best) { const b = best as { cls: Cls; strong: boolean; term: string }; return { cls: b.cls, strong: b.strong, term: b.term }; }
  // etichetta dopo la data (es. "30.11.2026 zahlbar bis")
  const p = post.slice(0, 30);
  if (DUE_STRONG.test(p)) return { cls: 'due', strong: false, term: 'dopo' };
  return { cls: 'other', strong: false };
}

// ---------------------------------------------------------------- tipo

const KIND_RULES: { kind: BillKind; rules: [RegExp, number][] }[] = [
  { kind: 'luce', rules: [[/energia elettrica|elettricit|electricit|elektrizit|stromrechnung|\bstrom\w*|electricity|power supply/, 4], [/\bluce\b|\bkwh\b|kilowatt|\bpod\b|potenza impegnata|\bnetzgebuhr|tariffa elettrica/, 3], [/\benel\b|\ba2a\b|edison|sorgenia|\baxpo\b|\bbkw\b|\bewz\b|groupe e\b|romande energie|\biwb\b|\bewb\b|\bail\b|\baet\b|iren\b|acea\b|ewl\b|aem\b|alpiq|repower|azienda elettrica/, 3]] },
  { kind: 'gas', rules: [[/\bgas\b|metano|\bsmc\b|\bpdr\b|erdgas|gasrechnung|gaz naturel|\bgaz\b|natural gas|riscaldamento a gas/, 4], [/eni plenitude|italgas|\bhera\b|gasverbund|gaznat/, 2]] },
  { kind: 'acqua', rules: [[/\bacqua\b|idric|acquedotto|\bwasser|abwasser|wasserverbrauch|\beau\b|water bill|water supply|servizio idrico|\bsii\b/, 4], [/\bm3\b|\bmc\b/, 0.5]] },
  { kind: 'internet', rules: [[/\binternet\b|\bfibra\b|\bfiber\b|\badsl\b|telefon|\bmobile\b|\bsim\b|mobilfunk|\bphone\b|telecom|broadband|roaming|\bgiga|connessione|\bwifi\b|\bwi-fi\b/, 3], [/vodafone|windtre|\bwind\b|fastweb|\biliad\b|swisscom|sunrise|\bsalt\b|wingo|yallo|quickline|\btim\b|\bupc\b|init7|digital republic|ho\.? mobile|poste ?mobile|kena/, 4]] },
  { kind: 'affitto', rules: [[/\baffitto\b|locazione|pigione|canone di locazione|\bmiete\b|mietzins|wohnungsmiete|\bloyer\b|\brent\b|landlord|locatore|nebenkosten|spese condominiali|condominio|hausverwaltung|bewirtschaftung|vermieter|bailleur|\bcharges locatives/, 4]] },
  { kind: 'assicurazione', rules: [[/assicurazion|polizza|\bpremio\b|\brca\b|cassa malati|krankenkasse|krankenversicherung|versicherung|pramie|assurance|\bprime\b|mutuelle|insurance|premium|responsabilita civile|\bpolice\b|versicherungspramie|prime d'assurance/, 4], [/helsana|\bcss\b|swica|sanitas|visana|concordia|groupe mutuel|\bassura\b|atupri|zurich|\baxa\b|allianz|generali|mobiliar|vaudoise|baloise|helvetia|unipol|reale mutua|cattolica|\bsympany\b|\begk\b|\bkpt\b/, 3]] },
  { kind: 'tasse', rules: [[/\bimposta\b|\bimposte\b|\btassa\b|\btasse\b|tributo|\btari\b|\bimu\b|\btasi\b|irpef|agenzia delle entrate|equitalia|riscossione|bollo auto|canone rai|steuer|steueramt|steuerrechnung|bundessteuer|kantonssteuer|gemeindesteuer|\bserafe\b|\bbillag\b|impots?\b|taxe fonciere|property tax|income tax|council tax|tax bill|\bf24\b|\bruolo\b|\bagenzia entrate\b|contributi inps|\binps\b/, 4]] },
  { kind: 'abbonamento', rules: [[/abbonamento|subscription|\babo\b|netflix|spotify|disney|amazon prime|apple\.com|icloud|google one|dazn|palestra|fitness|\bgym\b|\bsbb\b|travelcard|halbtax|mitgliedschaft|membership|abonnement|streaming|renewal|rinnovo|youtube premium|sky\b|cablecom|canone mensile/, 3]] },
  { kind: 'medico', rules: [[/\bmedic|\barzt\b|\baerzt|spital|zahnarzt|clinic|ospedal|\bvisita\b|prestazioni sanitarie|tarmed|medecin|hopital|dentiste|pharmacie|farmacia|doctor|dentist|hospital|physio|fisioterap|laborator|analisi del sangue|referto|praxis|arztrechnung|laboratoire/, 4]] },
];

function classifyKind(f: string, head: string, issuer: string): Field<BillKind> {
  const sc: { kind: BillKind; score: number; term: string }[] = KIND_RULES.map(({ kind, rules }) => {
    let s = 0, term = '';
    for (const [re, w] of rules) {
      const g = new RegExp(re.source, 'g');
      const hits = f.match(g) ?? [];
      if (hits.length) { s += w * Math.min(3, hits.length); if (!term) term = hits[0]; }
      if (re.test(head)) s += w;
      if (re.test(issuer)) s += w;
    }
    return { kind, score: s, term };
  }).sort((a, b) => b.score - a.score);
  const top = sc[0], second = sc[1];
  if (!top || top.score < 3) return { value: 'altro', confidence: 'bassa', source: t('Nessuna parola chiave riconosciuta') };
  const conf: Confidence = top.score >= 7 && top.score - second.score >= 3 ? 'alta' : 'media';
  return { value: top.kind, confidence: conf, source: t('Parola chiave: «{0}»', top.term.trim()), match: top.term.trim() };
}

// ---------------------------------------------------------------- emittente

const BRANDS: [RegExp, string][] = [
  [/\benel\b/, 'Enel'], [/\beni\b(?! plenitude)/, 'Eni'], [/eni plenitude/, 'Eni Plenitude'], [/\ba2a\b/, 'A2A'], [/\bhera\b/, 'Hera'], [/edison/, 'Edison'], [/\biren\b/, 'Iren'], [/\bacea\b/, 'Acea'], [/sorgenia/, 'Sorgenia'],
  [/telecom italia|\btim\b/, 'TIM'], [/vodafone/, 'Vodafone'], [/windtre|wind tre/, 'WindTre'], [/fastweb/, 'Fastweb'], [/\biliad\b/, 'Iliad'], [/swisscom/, 'Swisscom'], [/sunrise/, 'Sunrise'], [/\bsalt mobile\b|\bsalt\.ch\b/, 'Salt'], [/quickline/, 'Quickline'], [/wingo/, 'Wingo'], [/yallo/, 'Yallo'],
  [/\baxpo\b/, 'Axpo'], [/\bbkw\b/, 'BKW'], [/\bewz\b/, 'EWZ'], [/groupe e\b/, 'Groupe E'], [/romande energie/, 'Romande Energie'], [/\biwb\b/, 'IWB'], [/\bewb\b/, 'ewb'], [/alpiq/, 'Alpiq'], [/repower/, 'Repower'],
  [/helsana/, 'Helsana'], [/\bcss\b(?= (?:versicherung|assurance|assicurazione))|css versicherung/, 'CSS'], [/swica/, 'Swica'], [/sanitas/, 'Sanitas'], [/visana/, 'Visana'], [/concordia/, 'Concordia'], [/groupe mutuel/, 'Groupe Mutuel'], [/atupri/, 'Atupri'], [/sympany/, 'Sympany'],
  [/zurich insurance|zurich versicherung|zurich assicurazion/, 'Zurich'], [/\baxa\b/, 'AXA'], [/allianz/, 'Allianz'], [/generali/, 'Generali'], [/mobiliar/, 'Mobiliar'], [/vaudoise/, 'Vaudoise'], [/baloise|basler versicherung/, 'Baloise'], [/unipol/, 'UnipolSai'],
  [/\bserafe\b/, 'Serafe'], [/\bsbb\b|cff\b|ffs\b/, 'SBB'], [/netflix/, 'Netflix'], [/spotify/, 'Spotify'], [/disney\+?/, 'Disney+'], [/amazon prime/, 'Amazon Prime'], [/agenzia delle entrate/, 'Agenzia delle Entrate'], [/poste italiane/, 'Poste Italiane'],
];
const COMPANY = /\b(s\.?\s?p\.?\s?a\.?|s\.?\s?r\.?\s?l\.?s?|s\.?a\.?s\.?|s\.?n\.?c\.?|ag|sa|sagl|sarl|s\.a\.r\.l\.|gmbh|ltd|limited|inc|llc|plc|kg|ohg|ug|bv|nv|coop|soc\.? coop\.?|stiftung|fondation|genossenschaft|cooperativa)\b\.?/i;
const ISSUER_LBL = /^\s*(?:fornitore|emittente|creditore|beneficiario|ragione sociale|rechnungssteller|lieferant|glaubiger|zugunsten von|zahlbar an|payable to|beneficiary|vendor|supplier|issued by|fournisseur|emetteur|crediteur|beneficiaire|bill from|invoice from)\s*[:\-]\s*(.+)$/;
const QR_ACC = /^\s*(?:konto|compte|conto|account)\s*\/\s*(?:zahlbar an|payable a|payable to|pagabile a)/;
const NOT_NAME = /^(fattura|rechnung|invoice|bolletta|facture|pagina|page|seite|nota|avviso|bill|ricevuta|quittung|data|datum|date|cliente|kunde|customer|totale|total|iban|konto|pagamento|dettaglio|riepilogo)\b/;

function cleanName(s: string): string {
  let r = s.trim().replace(/\s{2,}.*$/, '').replace(/\s*[|•·].*$/, '');
  r = r.replace(/\s*[-,]\s*(via|viale|piazza|corso|strasse|str\.|rue|avenue|route|place|largo|vicolo|contrada|case postale|postfach|cp\b).*$/i, '');
  r = r.replace(/\s+\d{4,5}\s.*$/, '').replace(/[\s,;:-]+$/, '');
  return r.slice(0, 60).trim();
}

function findIssuer(lines: string[], fl: string[], qrName?: string): Field<string> | undefined {
  if (qrName) return { value: qrName, confidence: 'alta', source: t('Codice QR della fattura'), match: qrName };
  for (let i = 0; i < lines.length; i++) {
    if (QR_ACC.test(fl[i])) {
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const ln = lines[j].trim();
        if (!ln || checkIban(ln.replace(/\s/g, '')) || /^[\dA-Z ]{15,40}$/.test(ln) && /\d/.test(ln)) continue;
        if (/[a-zA-Z]{3}/.test(ln) && !NOT_NAME.test(fold(ln))) return { value: cleanName(ln), confidence: 'alta', source: ln, match: ln };
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const m = ISSUER_LBL.exec(fl[i]);
    if (m) { const v = lines[i].slice(lines[i].length - m[1].length).trim(); if (/[a-zA-Z]{3}/.test(v)) return { value: cleanName(v), confidence: 'alta', source: lines[i].trim(), match: v }; }
  }
  const head = fl.slice(0, 14).join('\n');
  const whole = fl.join('\n');
  for (const [re, name] of BRANDS) {
    const inHead = re.test(head);
    if (inHead || re.test(whole)) {
      const idx = fl.findIndex((l) => re.test(l));
      return { value: name, confidence: inHead ? 'alta' : 'media', source: idx >= 0 ? lines[idx].trim().slice(0, 120) : name, match: name };
    }
  }
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const ln = lines[i].trim();
    if (ln.length < 4 || ln.length > 90 || NOT_NAME.test(fold(ln))) continue;
    if (COMPANY.test(ln) && /[a-zA-Z]{3}/.test(ln) && !/\d{5,}/.test(ln)) { const v = cleanName(ln); if (v.length >= 3) return { value: v, confidence: 'media', source: ln, match: ln.slice(0, v.length) }; }
  }
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const ln = lines[i].trim();
    if (ln.length >= 3 && ln.length <= 50 && /[a-zA-Z]{3}/.test(ln) && !/\d{4,}/.test(ln) && !NOT_NAME.test(fold(ln)) && !/^(www\.|http|tel|via |viale |strasse|rue )/i.test(ln)) return { value: cleanName(ln), confidence: 'bassa', source: ln, match: ln };
  }
  return undefined;
}

// ---------------------------------------------------------------- QR-bill svizzero (contenuto del codice)

type QrPayload = { iban: string; name: string; amount?: number; currency: string; refType: string; ref: string; message?: string };
function parseSwissQr(lines: string[]): QrPayload | null {
  const i = lines.findIndex((l) => l.trim() === 'SPC');
  if (i < 0) return null;
  const q = lines.slice(i).map((l) => l.trim());
  if (q.length < 29 || !/^02\d\d$/.test(q[1] ?? '')) return null;
  const iban = compact(q[3] ?? '');
  const info = checkIban(iban);
  if (!info) return null;
  const amtStr = (q[18] ?? '').trim();
  const amount = amtStr && /^\d+(\.\d{1,2})?$/.test(amtStr) ? parseFloat(amtStr) : undefined;
  return { iban, name: (q[5] ?? '').trim(), amount: amount && amount > 0 ? amount : undefined, currency: (q[19] ?? 'CHF').trim() || 'CHF', refType: (q[27] ?? '').trim(), ref: (q[28] ?? '').trim(), message: (q[29] ?? '').trim() };
}

// ---------------------------------------------------------------- IBAN e riferimenti

function trimToValidIban(raw: string): ReturnType<typeof checkIban> {
  const parts = raw.trim().split(/\s+/);
  for (let k = parts.length; k >= 3; k--) { const c = checkIban(parts.slice(0, k).join('')); if (c && c.valid) return c; }
  return checkIban(parts.join(''));
}
const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/gi;

// ---------------------------------------------------------------- funzione principale

const field = <T,>(value: T, confidence: Confidence, source: string, match?: string, note?: string): Field<T> => ({ value, confidence, source, ...(match ? { match } : {}), ...(note ? { note } : {}) });

export function parseBillText(rawText: string, opts: ParseOptions = {}): BillDraft {
  const text = normalizeText(rawText ?? '');
  const lines = text.split('\n');
  const fl = lines.map(fold);
  const all = fl.join('\n');
  const today = opts.today && isIso(opts.today) ? opts.today : undefined;
  const lang = detectLang(all);
  const warnings: string[] = [];
  const ambiguities: string[] = [];

  const qr = parseSwissQr(lines);
  const draftBase: BillDraft = {
    lang, kind: { value: 'altro', confidence: 'bassa', source: '' }, amountAlternatives: [], warnings, ambiguities, empty: false, textLength: text.trim().length,
  };

  // ---- date (prima: servono a mascherare le cifre nei calcoli degli importi)
  type LineDates = { hits: DateHit[] };
  const perLine: LineDates[] = fl.map((f) => ({ hits: findDates(f) }));
  // ordine delle date numeriche con separatore '/' o '-'
  let order: 'dmy' | 'mdy' | undefined;
  let orderConflict = false;
  perLine.forEach((l) => l.hits.forEach((h) => {
    if (h.kind !== 'num' || h.sep === '.') return;
    if ((h.a as number) > 12 && (h.b as number) <= 12) { if (order === 'mdy') orderConflict = true; order = order ?? 'dmy'; }
    else if ((h.b as number) > 12 && (h.a as number) <= 12) { if (order === 'dmy') orderConflict = true; order = order ?? 'mdy'; }
  }));
  if (orderConflict) { order = 'dmy'; warnings.push(t('Le date numeriche del documento usano ordini diversi (gg/mm e mm/gg): controllale una per una.')); }
  const hint = opts.dateOrder;
  perLine.forEach((l) => {
    l.hits.forEach((h) => {
      if (h.kind !== 'num') return;
      const a = h.a as number, b = h.b as number, y = h.y as number;
      let o: 'dmy' | 'mdy';
      let amb = false;
      if (h.sep === '.') o = 'dmy';
      else if (a > 12) o = 'dmy';
      else if (b > 12) o = 'mdy';
      else if (a === b) o = 'dmy';
      else if (order) o = order;
      else if (hint) { o = hint; amb = lang === 'en' || hint === 'mdy'; }
      else if (lang === 'en') { o = 'dmy'; amb = true; }
      else o = 'dmy';
      const d = o === 'dmy' ? a : b, mo = o === 'dmy' ? b : a;
      if (!validYmd(y, mo, d)) {
        // prova l'altro ordine
        const d2 = o === 'dmy' ? b : a, mo2 = o === 'dmy' ? a : b;
        if (validYmd(y, mo2, d2)) { h.iso = mkIso(y, mo2, d2); } else h.iso = '';
        return;
      }
      h.iso = mkIso(y, mo, d);
      if (amb && a !== b && a <= 12 && b <= 12) {
        h.ambiguousOrder = true;
        const alt = o === 'dmy' ? mkIso(y, a, b) : mkIso(y, b, a);
        if (validYmd(+alt.slice(0, 4), +alt.slice(5, 7), +alt.slice(8, 10))) h.alt = alt;
      }
    });
    l.hits = l.hits.filter((h) => h.iso);
  });
  // anno mancante: prossima occorrenza rispetto a oggi
  perLine.forEach((l) => l.hits.forEach((h) => {
    if (!h.yearless) return;
    const base = today ?? mkIso(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    const y0 = +base.slice(0, 4);
    let cand = mkIso(y0, +h.iso.slice(5, 7), +h.iso.slice(8, 10));
    if (!validYmd(y0, +h.iso.slice(5, 7), +h.iso.slice(8, 10))) return;
    if (diffDays(base, cand) < -60) cand = mkIso(y0 + 1, +h.iso.slice(5, 7), +h.iso.slice(8, 10));
    h.iso = cand;
  }));
  perLine.forEach((l) => { l.hits = l.hits.filter((h) => !h.iso.startsWith('0000')); });

  type DCand = { hit: DateHit; line: number; lbl: Lbl; period?: boolean };
  const dcs: DCand[] = [];
  let periodFrom: DCand | undefined, periodTo: DCand | undefined;
  perLine.forEach((l, li) => {
    const f = fl[li];
    const prevLabel = (() => {
      // etichetta nella riga sopra se questa riga non ha lettere prima della data
      return li > 0 ? fl[li - 1] : '';
    })();
    for (let k = 0; k < l.hits.length; k++) {
      const h = l.hits[k];
      const pre = f.slice(Math.max(0, h.start - 70), h.start);
      let lbl = classify(pre, f.slice(h.end));
      if (lbl.cls === 'other' && (pre.replace(/[^a-z]/g, '').length < 3)) lbl = classify(prevLabel.slice(-90), '');
      // coppia di date = periodo
      const next = l.hits[k + 1];
      if (next && PERIOD_GAP.test(f.slice(h.end, next.start)) && !(lbl.cls === 'due' && lbl.strong && /zahlbar|scad|due|fallig|echeance/.test(lbl.term ?? ''))) {
        const c1: DCand = { hit: h, line: li, lbl: { cls: 'period', strong: true }, period: true };
        const c2: DCand = { hit: next, line: li, lbl: { cls: 'period', strong: true }, period: true };
        dcs.push(c1, c2);
        if (!periodFrom && diffDays(h.iso, next.iso) >= 0) { periodFrom = c1; periodTo = c2; }
        k++;
        continue;
      }
      if (lbl.cls === 'other' && PERIOD_LBL.test(f.slice(Math.max(0, h.start - 40), h.start))) lbl = { cls: 'period', strong: false };
      dcs.push({ hit: h, line: li, lbl });
    }
  });

  const dateField = (c: DCand, conf: Confidence): Field<string> => {
    let cf = conf;
    let note: string | undefined;
    if (c.hit.ambiguousOrder) {
      cf = 'media';
      note = t('Data ambigua: potrebbe essere anche il {0}', c.hit.alt ?? '');
      ambiguities.push(t('La data «{0}» e\' ambigua (gg/mm o mm/gg): ho letto {1}, potrebbe essere {2}.', c.hit.raw, c.hit.iso, c.hit.alt ?? ''));
    }
    return field(c.hit.iso, cf, snippet(lines[c.line], c.hit.start, c.hit.end), c.hit.raw, note);
  };

  let dueDate: Field<string> | undefined;
  const dues = dcs.filter((c) => c.lbl.cls === 'due');
  if (dues.length) {
    const strong = dues.filter((c) => c.lbl.strong);
    const pool = strong.length ? strong : dues;
    const pick = pool[0];
    dueDate = dateField(pick, pick.lbl.strong ? 'alta' : 'media');
    const others = [...new Set(pool.map((c) => c.hit.iso))].filter((x) => x !== pick.hit.iso);
    if (others.length) {
      if (dueDate.confidence === 'alta') dueDate.confidence = 'media';
      ambiguities.push(t('Ho trovato piu\' scadenze ({0}): ho scelto {1}, controlla.', [pick.hit.iso, ...others].join(', '), pick.hit.iso));
    }
  }

  let issueDate: Field<string> | undefined;
  const issues = dcs.filter((c) => c.lbl.cls === 'issue');
  if (issues.length) {
    const strong = issues.filter((c) => c.lbl.strong);
    const pick = (strong.length ? strong : issues)[0];
    issueDate = dateField(pick, pick.lbl.strong ? 'alta' : 'media');
  }
  if (!issueDate) {
    const free = dcs.filter((c) => c.lbl.cls === 'other' && !c.period && c.hit.iso !== dueDate?.value);
    if (free.length) {
      const earliest = free.slice().sort((a, b) => a.hit.iso.localeCompare(b.hit.iso))[0];
      if (!dueDate || earliest.hit.iso <= dueDate.value) issueDate = dateField(earliest, 'bassa');
    }
  }
  // scadenza relativa ("entro 30 giorni dalla data fattura")
  if (!dueDate) {
    const rel = /(?:entro|within|innert|binnen|dans les|sous|zahlbar innert|zahlbar in|payable within|pagabile a|pagamento a|net|netto|zahlungsbedingungen[^\d\n]{0,25}|zahlungsziel|payment terms?[^\d\n]{0,12})\s*(\d{1,3})\s*(?:giorni|gg\b|days|tagen|tage\b|jours|j\b)/;
    const rel2 = /(\d{1,3})\s*(?:giorni|gg\b|days|tage|jours)\s*(?:data fattura|dalla data|dal ricevimento|netto|net|from invoice|ab rechnungsdatum|date de facture)/;
    for (let i = 0; i < fl.length && !dueDate; i++) {
      const m = rel.exec(fl[i]) ?? rel2.exec(fl[i]);
      if (m) {
        const n = +m[1];
        if (n >= 1 && n <= 120 && issueDate) {
          dueDate = field(addDays(issueDate.value, n), issueDate.confidence === 'alta' ? 'media' : 'bassa', lines[i].trim().slice(0, 120), m[0].trim(), t('Calcolata: {0} giorni dalla data del documento', n));
        } else if (n >= 1 && n <= 120) {
          warnings.push(t('Il documento dice di pagare entro {0} giorni, ma non trovo la data di emissione: inserisci la scadenza a mano.', n));
        }
      }
    }
  }

  // ---- importi
  const amts: Amt[] = [];
  const cleaned = lines.map((ln, i) => {
    let s = ln;
    perLine[i].hits.forEach((h) => { s = blankSpan(s, h.start, h.end); });
    // masca IBAN e sequenze lunghe di cifre
    s = s.replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, (m0) => ' '.repeat(m0.length));
    s = s.replace(/\b\d(?:[ ]?\d){11,}\b/g, (m0) => ' '.repeat(m0.length));
    return s;
  });
  cleaned.forEach((ln, li) => {
    const re = AMT_RE();
    let m: RegExpExecArray | null;
    while ((m = re.exec(ln))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      const numStr = m[2];
      const numStart = m.index + m[0].indexOf(numStr);
      const prevCh = numStart > 0 ? ln[numStart - 1] : '';
      const prev2 = numStart > 1 ? ln[numStart - 2] : '';
      if (/\d/.test(prevCh) || (/[./-]/.test(prevCh) && /\d/.test(prev2))) continue;
      const pa = parseAmount(numStr);
      if (!pa || pa.value <= 0) continue;
      const cur = curCode(m[1]) ?? curCode(m[3]);
      const decimals = /[.,]\d{2}$/.test(numStr);
      const ownFold = fold(blankSpan(ln, m.index, m.index + m[0].length));
      const letters = ownFold.replace(/[^a-z]/g, '').length;
      let score: number;
      if (letters < 4 && li > 0) {
        const pv = fl[li - 1];
        score = QR_HEAD.test(pv) ? 9 : kwScore(pv);
        if (!(letters >= 1) && li > 1 && score <= 0) score = Math.max(score, kwScore(fl[li - 2]) >= 12 ? 6 : score);
      } else score = kwScore(ownFold);
      const accept = cur || decimals || score >= 12;
      if (!accept) continue;
      if (!cur && !decimals && (pa.value < 10 || /^(19|20)\d\d$/.test(numStr))) continue;
      amts.push({ value: pa.value, line: li, start: m.index, end: m.index + m[0].length, raw: m[0].trim(), cur, score, ambiguous: pa.ambiguous, decimals });
    }
  });

  let amount: Field<number> | undefined;
  let currency: Field<string> | undefined;
  if (qr?.amount) {
    amount = field(qr.amount, 'alta', t('Codice QR della fattura'), String(qr.amount));
  }
  if (!amount && amts.length) {
    amts.forEach((a, i) => { a.score += (i / Math.max(1, amts.length)) * 0.5; });
    const sorted = amts.slice().sort((a, b) => b.score - a.score || b.line - a.line || b.value - a.value);
    const best = sorted[0];
    const distinctTop = new Set(sorted.filter((a) => a.score >= 9 && a.score >= best.score - 0.9).map((a) => a.value));
    let conf: Confidence = best.score >= 9 ? 'alta' : best.score >= 4 ? 'media' : 'bassa';
    let note: string | undefined;
    if (distinctTop.size > 1 && conf === 'alta') { conf = 'media'; note = t('Piu\' importi sembrano il totale: controlla'); ambiguities.push(t('Ci sono piu\' importi che sembrano il totale da pagare: {0}.', [...distinctTop].join(', '))); }
    if (best.ambiguous) { if (conf === 'alta') conf = 'media'; ambiguities.push(t('L\'importo «{0}» potrebbe avere un altro separatore dei decimali: controlla.', best.raw)); }
    if (conf === 'bassa') note = t('Non ho trovato la scritta «totale da pagare»: e\' l\'importo piu\' probabile, controlla');
    amount = field(best.value, conf, snippet(lines[best.line], best.start, best.end), best.raw, note);
    const seen = new Set<number>();
    sorted.forEach((a) => { if (!seen.has(a.value) && seen.size < 5) { seen.add(a.value); draftBase.amountAlternatives.push({ value: a.value, source: snippet(lines[a.line], a.start, a.end), score: Math.round(a.score * 10) / 10 }); } });
    const bestCur = best.cur;
    if (bestCur) currency = field(bestCur, 'alta', snippet(lines[best.line], best.start, best.end), best.raw);
  }
  if (!currency) {
    if (qr) currency = field(qr.currency, 'alta', t('Codice QR della fattura'), qr.currency);
    else {
      const counts: Record<string, number> = {};
      const re = /\b(CHF|EUR|USD|GBP)\b|(€)|(\$)|(£)|\bFr\./g;
      let m: RegExpExecArray | null;
      let firstLine = '';
      while ((m = re.exec(text))) {
        const c = curCode(m[0]);
        if (c) { counts[c] = (counts[c] ?? 0) + 1; if (!firstLine) { const ls = text.lastIndexOf('\n', m.index) + 1; firstLine = text.slice(ls, text.indexOf('\n', m.index) < 0 ? undefined : text.indexOf('\n', m.index)).trim().slice(0, 120); } }
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) currency = field(top[0], 'media', firstLine, top[0]);
      else if (opts.defaultCurrency) currency = field(opts.defaultCurrency, 'bassa', t('Nel documento non si vede la valuta: uso quella dell\'app'));
    }
  }

  // ---- IBAN, riferimenti
  let iban: Field<string> | undefined;
  let qrIban = false;
  if (qr) {
    const info = checkIban(qr.iban);
    iban = field(formatIban(qr.iban), info?.valid ? 'alta' : 'bassa', t('Codice QR della fattura'), qr.iban);
    qrIban = !!info?.qrIban;
  } else {
    let bestI: { v: NonNullable<ReturnType<typeof checkIban>>; li: number; raw: string; ctx: boolean } | undefined;
    for (let li = 0; li < lines.length; li++) {
      const re = new RegExp(IBAN_RE.source, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(lines[li].toUpperCase()))) {
        const info = trimToValidIban(m[0]);
        if (!info) continue;
        const ctx = /iban|konto|conto|compte|account|bonifico|zahlbar an|payable/.test(fl[li]) || (li > 0 && /iban|konto|conto|compte|account/.test(fl[li - 1]));
        if (info.valid ? (!bestI || !bestI.v.valid || (ctx && !bestI.ctx)) : (ctx && !bestI)) bestI = { v: info, li, raw: m[0], ctx };
      }
    }
    if (bestI) {
      iban = field(formatIban(bestI.v.iban), bestI.v.valid ? 'alta' : 'bassa', lines[bestI.li].trim().slice(0, 120), bestI.raw.trim());
      qrIban = bestI.v.qrIban;
      if (!bestI.v.valid) warnings.push(t('L\'IBAN letto non supera il controllo di validita\' (cifre di controllo): verifica ogni cifra prima di pagare.'));
    }
  }

  let reference: Field<string> | undefined;
  let referenceType: BillDraft['referenceType'];
  if (qr && qr.ref && qr.refType !== 'NON') {
    if (qr.refType === 'QRR') { const c = checkQrr(qr.ref); reference = field(formatQrr(qr.ref), c?.valid ? 'alta' : 'bassa', t('Codice QR della fattura'), qr.ref); referenceType = 'QRR'; if (!c?.valid) warnings.push(t('Il riferimento QR non supera la cifra di controllo (modulo 10): verifica.')); }
    else if (qr.refType === 'SCOR') { const c = checkScor(qr.ref); reference = field(qr.ref, c?.valid ? 'alta' : 'bassa', t('Codice QR della fattura'), qr.ref); referenceType = 'SCOR'; }
  }
  if (!reference) {
    for (let li = 0; li < lines.length && !reference; li++) {
      const ln = lines[li];
      const qm = /(?:^|[^\d])(\d{2}(?: ?\d{5}){5})(?!\d)/.exec(ln) ?? /(?:^|[^\d])(\d{27})(?!\d)/.exec(ln);
      if (qm) {
        const c = checkQrr(qm[1]);
        if (c) {
          reference = field(formatQrr(c.ref), c.valid ? 'alta' : 'bassa', ln.trim().slice(0, 120), qm[1]);
          referenceType = 'QRR';
          if (!c.valid) warnings.push(t('Il riferimento QR non supera la cifra di controllo (modulo 10): puo\' essere un errore di lettura, verifica.'));
          break;
        }
      }
      const sm = /\bRF\d{2}(?: ?[A-Z0-9]{1,4}){1,6}\b/i.exec(ln);
      if (sm) {
        let cand = sm[0];
        let c = checkScor(cand);
        const parts = cand.split(/\s+/);
        for (let k = parts.length; k >= 1 && !(c && c.valid); k--) { cand = parts.slice(0, k).join(''); c = checkScor(cand); }
        if (c && c.valid) { reference = field(c.ref, 'alta', ln.trim().slice(0, 120), sm[0]); referenceType = 'SCOR'; break; }
      }
    }
  }
  if (!reference) {
    const g = /(?:riferimento di pagamento|numero di riferimento|zahlungsreferenz|referenznummer|reference de paiement|payment reference|riferimento|referenz)\s*[:#]?\s*([A-Z0-9][A-Z0-9 \-/]{5,34}\d)/i;
    for (let li = 0; li < lines.length; li++) {
      const m = g.exec(lines[li]);
      if (m && /\d{4}/.test(m[1])) { reference = field(m[1].trim(), 'media', lines[li].trim().slice(0, 120), m[1].trim()); referenceType = 'ALTRO'; break; }
    }
  }
  if (qrIban && referenceType !== 'QRR') warnings.push(t('E\' un QR-IBAN: serve il riferimento QR (27 cifre) per accreditare il pagamento. Non l\'ho trovato.'));

  // ---- PagoPA
  let pagopa: Field<string> | undefined;
  for (let li = 0; li < lines.length && !pagopa; li++) {
    const ctx = fl[li] + ' ' + (li > 0 ? fl[li - 1] : '') + ' ' + (li > 1 ? fl[li - 2] : '');
    if (!/avviso|pagopa|pago pa|\brav\b|cbill|bollettino/.test(ctx)) continue;
    const re = /(?:^|[^\d])((?:\d[ .-]?){17}\d)(?!\d)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lines[li]))) {
      const c = checkPagoPa(m[1]);
      if (c) { pagopa = field(formatPagoPa(c.code), c.valid && /codice avviso|numero avviso|avviso pagopa|pagopa/.test(ctx) ? 'alta' : 'media', lines[li].trim().slice(0, 120), m[1].trim()); break; }
    }
  }

  // ---- numero documento
  let number: Field<string> | undefined;
  {
    const TOK = '([A-Z0-9][A-Z0-9/\\-._]*\\d[A-Z0-9/\\-._]*)';
    const reA = new RegExp('(?:numero fattura|numero bolletta|numero documento|rechnungsnummer|rechnungs-?nr\\.?|n\\u00b0\\s?de facture|invoice\\s*(?:no|number|nr|#)\\.?|n\\. fattura|nr\\. fattura|invoice id)\\s*[:#]?\\s*' + TOK, 'i');
    const reB = new RegExp('\\b(?:fattura|bolletta|rechnung|facture|invoice|bill|nota di (?:credito|debito)|ricevuta|avviso di pagamento)(?:\\s+[a-z\\u00e0-\\u00ff]+){0,2}?\\s*(?:n|nr|no|num|numero|nummer|n\\u00b0|n\\u00ba|#)\\s*\\.?[\\u00b0\\u00ba]?\\s*[:#]?\\s*' + TOK, 'i');
    const reC = new RegExp('\\b(?:fattura|rechnung|invoice|facture)\\s+' + TOK, 'i');
    const bad = (v: string) => /^\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}$/.test(v) || v.length < 3 || /^(19|20)\\d\\d$/.test(v);
    for (const [re, conf] of [[reA, 'alta'], [reB, 'media'], [reC, 'bassa']] as const) {
      for (let li = 0; li < lines.length && !number; li++) {
        const m = re.exec(lines[li]);
        if (!m) continue;
        const v = m[1].replace(/[.,;:]+$/, '');
        if (bad(v)) continue;
        number = field(v, conf, lines[li].trim().slice(0, 120), v);
      }
      if (number) break;
    }
  }

  // ---- partita IVA / UID
  let taxId: Field<string> | undefined;
  {
    const re = /(?:p\.?\s?iva|partita iva|vat(?: id| no\.?| number)?|uid|mwst(?:-nr\.?)?|n° tva|tva|ust-?id)\s*[:.]?\s*((?:IT)?\d{11}|CHE[- ]?\d{3}[. ]?\d{3}[. ]?\d{3}(?: ?(?:MWST|TVA|IVA))?|[A-Z]{2}\d{8,12})/i;
    const re3 = /\b(CHE[- ]?\d{3}[. ]?\d{3}[. ]?\d{3}(?: ?(?:MWST|TVA|IVA))?)/;
    for (let li = 0; li < lines.length && !taxId; li++) {
      const m = re.exec(lines[li]) ?? re3.exec(lines[li]);
      if (m) taxId = field(m[1].trim(), 'alta', lines[li].trim().slice(0, 120), m[1].trim());
    }
  }

  // ---- penali, interessi, solleciti
  let lateFee: Field<number> | undefined;
  let lateInterestPct: Field<number> | undefined;
  {
    const feeRe = /(spese di sollecito|spese di mora|spese di insoluto|diritti di mora|indennita di mora|penale|penalita|mahngebuhr\w*|mahnspesen|bearbeitungsgebuhr|frais de rappel|frais de retard|late fee|late payment fee|reminder fee|collection fee|mora)/;
    const intRe = /(interess\w* (?:di )?mora|verzugszins\w*|zins\w* bei verzug|interets? (?:moratoires?|de retard)|late (?:payment )?interest|default interest)[^\d%\n]{0,45}(\d{1,2}(?:[.,]\d{1,2})?)\s*%/;
    for (let li = 0; li < lines.length; li++) {
      const f = fl[li];
      const im = intRe.exec(f);
      if (im && !lateInterestPct) { const v = parseFloat(im[2].replace(',', '.')); if (v > 0 && v < 40) lateInterestPct = field(v, 'media', lines[li].trim().slice(0, 120), im[0]); }
      if (!lateFee && feeRe.test(f) && !/%/.test(f.slice(feeRe.exec(f)!.index, feeRe.exec(f)!.index + 70))) {
        const near = amts.filter((a) => a.line === li && (a.cur || a.decimals));
        if (near.length) { const a = near[0]; lateFee = field(a.value, 'media', snippet(lines[li], a.start, a.end), a.raw); }
      }
    }
  }
  let reminderNotice: Field<number> | undefined;
  {
    const L3 = /(ultimo avviso|ultima richiesta|ultimo sollecito|letzte mahnung|3\. ?mahnung|dritte mahnung|dernier rappel|final notice|last reminder|final demand|diffida|messa in mora|costituzione in mora|formal notice|mise en demeure|inkasso|recupero crediti|betreibung|precetto|inkassoauftrag)/;
    const L2 = /(secondo sollecito|2\. ?mahnung|zweite mahnung|deuxieme rappel|second reminder|2nd reminder|second notice)/;
    const L1 = /(sollecito di pagamento|sollecito|promemoria di pagamento|zahlungserinnerung|mahnung|rappel de paiement|\brappel\b|payment reminder|reminder of payment|overdue notice|overdue invoice|past due|amount overdue|importo scaduto|fattura scaduta|bolletta scaduta|rechnung ist uberfallig|uberfallig|en retard de paiement)/;
    for (let li = 0; li < Math.min(lines.length, 60) && !reminderNotice; li++) {
      const f = fl[li];
      const head = lines[li].trim().length <= 80;
      const lvl = L3.test(f) ? 3 : L2.test(f) ? 2 : L1.test(f) ? 1 : 0;
      if (!lvl) continue;
      // frasi condizionali ("in caso di sollecito..."): non sono un sollecito in corso
      if (/\b(in caso di|se non|qualora|bei nichtbezahlung|falls|if (?:payment|we do)|en cas de|a defaut)\b/.test(f) && !head) continue;
      const conf: Confidence = head && li < 18 ? 'alta' : 'media';
      reminderNotice = field(lvl, conf, lines[li].trim().slice(0, 120), (L3.exec(f) ?? L2.exec(f) ?? L1.exec(f))![0]);
    }
  }
  if (reminderNotice) warnings.push(t('Sembra un sollecito di pagamento: paga il prima possibile per evitare altre spese.'));

  // ---- emittente, tipo
  const issuer = findIssuer(lines, fl, qr?.name);
  const head = fl.slice(0, 12).join('\n');
  const kind = classifyKind(all, head, fold(issuer?.value ?? ''));

  // ---- periodo, ricorrenza
  let pFrom: Field<string> | undefined, pTo: Field<string> | undefined;
  if (periodFrom && periodTo) {
    pFrom = dateField(periodFrom, 'media'); pTo = dateField(periodTo, 'media');
  }
  let recurrence: Field<Recurrence> | undefined;
  if (pFrom && pTo) {
    const days = diffDays(pFrom.value, pTo.value) + 1;
    const r: Recurrence | undefined = days >= 25 && days <= 35 ? 'monthly' : days >= 55 && days <= 66 ? 'bimonthly' : days >= 85 && days <= 100 ? 'quarterly' : days >= 350 && days <= 380 ? 'yearly' : undefined;
    if (r) recurrence = field(r, 'bassa', t('Periodo di {0} giorni', days));
  }
  if (!recurrence) {
    const m = /(mensile|monatlich|mensuel|monthly|trimestrale|vierteljahr|quartal|trimestriel|quarterly|bimestrale|annuale|jahrlich|jahres|annuel|yearly|annual)/.exec(all);
    if (m) {
      const w = m[1];
      const r: Recurrence = /mensile|monatlich|mensuel|monthly/.test(w) ? 'monthly' : /trimestr|vierteljahr|quartal|quarterly/.test(w) ? 'quarterly' : /bimestr/.test(w) ? 'bimonthly' : 'yearly';
      const idx = fl.findIndex((l) => l.includes(w));
      recurrence = field(r, 'bassa', lines[idx >= 0 ? idx : 0].trim().slice(0, 120), w);
    }
  }

  // ---- controlli di coerenza
  if (!amount) warnings.push(t('Non trovo l\'importo da pagare: inseriscilo a mano.'));
  if (!dueDate) warnings.push(t('Non trovo la scadenza: inseriscila a mano, senza non posso programmare i promemoria.'));
  if (dueDate && issueDate && diffDays(issueDate.value, dueDate.value) < -1) warnings.push(t('La scadenza ({0}) e\' prima della data del documento ({1}): controlla le date.', dueDate.value, issueDate.value));
  if (dueDate && today && diffDays(today, dueDate.value) < 0) warnings.push(t('La scadenza e\' gia\' passata: il pagamento e\' in ritardo.'));
  if (dueDate && today && diffDays(today, dueDate.value) > 400) warnings.push(t('La scadenza e\' fra piu\' di un anno: controlla l\'anno.'));

  const out: BillDraft = {
    ...draftBase,
    lang,
    kind,
    ...(issuer ? { issuer } : {}), ...(amount ? { amount } : {}), ...(currency ? { currency } : {}),
    ...(issueDate ? { issueDate } : {}), ...(dueDate ? { dueDate } : {}), ...(pFrom ? { periodFrom: pFrom } : {}), ...(pTo ? { periodTo: pTo } : {}),
    ...(number ? { number } : {}), ...(iban ? { iban } : {}), ...(reference ? { reference, referenceType } : {}), ...(qrIban ? { qrIban } : {}),
    ...(pagopa ? { pagopa } : {}), ...(taxId ? { taxId } : {}), ...(recurrence ? { recurrence } : {}),
    ...(lateFee ? { lateFee } : {}), ...(lateInterestPct ? { lateInterestPct } : {}), ...(reminderNotice ? { reminderNotice } : {}),
  };
  out.empty = !out.amount && !out.dueDate && !out.iban && !out.number && !(out.issuer && out.issuer.confidence !== 'bassa');
  return out;
}
