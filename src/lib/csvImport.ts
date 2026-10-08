/**
 * Import di movimenti da CSV / estratto conto (UBS, PostFinance, Raiffeisen, ZKB, Revolut, export generici).
 * Modulo PURO e testabile. Riconosce: separatore (; , tab |), formato date (dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd),
 * decimali con virgola o punto e apice svizzero (1'234.50), colonne data / descrizione / importo oppure dare-avere (debito-credito).
 */
export type CsvRow = { date: string; label: string; amount: number; category: string | null };
export type ParseResult = { rows: CsvRow[]; delimiter: string; skipped: number; warnings: string[]; columns: { date: string; desc: string[]; amount: string | null; debit: string | null; credit: string | null } | null };

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** Decodifica byte: UTF-8 se valido, altrimenti Windows-1252 (tipico degli estratti delle banche svizzere). */
export function decodeBytes(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let txt: string;
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(u8); }
  catch { try { txt = new TextDecoder('windows-1252').decode(u8); } catch { txt = Array.from(u8, (b) => String.fromCharCode(b)).join(''); } }
  return txt.replace(/^﻿/, '');
}

/** Separa il testo in righe di celle, rispettando le virgolette. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** Sceglie il separatore con il numero di colonne più coerente tra le prime righe. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  let best = ';', bestScore = -1;
  for (const d of [';', ',', '\t', '|']) {
    const counts = lines.map((l) => splitCsv(l, d)[0]?.length ?? 1);
    const multi = counts.filter((c) => c > 1);
    if (!multi.length) continue;
    const mode = multi.sort((a, b) => multi.filter((x) => x === b).length - multi.filter((x) => x === a).length)[0];
    const score = counts.filter((c) => c === mode).length * 100 + mode;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/** Importo da testo: "1'234.50", "1’234,50", "-45,90", "45.90-", "CHF 12.50", "(12.50)", "1.234,56", "1,234.56". */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }
  if (/^\s*[-−–]/.test(s)) { neg = !neg || false; s = s.replace(/^\s*[-−–]\s*/, ''); neg = true; }
  s = s.replace(/^\+/, '').replace(/(CHF|EUR|USD|Fr\.?|SFr\.?|€|\$)/gi, '').replace(/[\s'’`´ ]/g, '');
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.'), lastCom = s.lastIndexOf(',');
  let dec = -1;
  if (lastDot >= 0 && lastCom >= 0) dec = Math.max(lastDot, lastCom);
  else if (lastDot >= 0 || lastCom >= 0) {
    const pos = Math.max(lastDot, lastCom), sep = s[pos];
    const count = s.split(sep).length - 1;
    const after = s.length - pos - 1;
    dec = count === 1 && after !== 3 ? pos : count === 1 && after === 3 && /^0/.test(s) ? pos : -1;
    if (count === 1 && after === 3 && !/^0[.,]/.test(s)) dec = -1;
  }
  const num = dec >= 0 ? s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1) : s.replace(/[.,]/g, '');
  const v = parseFloat(num);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

/** Data -> "yyyy-mm-dd" (dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, yyyy/mm/dd, yyyymmdd, dd.mm.yy). */
export function parseDate(raw: string): string | null {
  const s = String(raw ?? '').trim().replace(/[T\s].*$/, '');
  let y: number, m: number, d: number, r: RegExpExecArray | null;
  if ((r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s))) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else if ((r = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/.exec(s))) { d = +r[1]; m = +r[2]; y = 2000 + +r[3]; }
  else if ((r = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${p2(m)}-${p2(d)}`;
}

/** "yyyy-mm-dd" -> "dd/mm" e nome del mese dell'app ("Ottobre 2026"). */
export const toAppDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const monthLabelOfIso = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/* ---------- colonne ---------- */
const norm = (h: string) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const DATE_PRIMARY = ['booking date', 'buchungsdatum', 'buchungsdat', 'data contabile', 'data operazione', 'data registrazione', 'date comptable', 'transaction date', 'trade date', 'completed date', 'started date', 'data', 'datum', 'date', 'valuta', 'value date', 'valutadatum', 'date de valeur'];
const DESC = ['description', 'descrizione', 'beschreibung', 'avisierungstext', 'buchungstext', 'text', 'details', 'detail', 'dettagli', 'causale', 'motivo', 'beneficiario', 'zahlungsempfaenger', 'zahlungsempfanger', 'verwendungszweck', 'libelle', 'reference', 'riferimento', 'merchant', 'name', 'nome', 'mitteilung'];
const AMOUNT = ['importo', 'betrag', 'amount', 'montant', 'individual amount', 'valore', 'saldo movimento'];
const DEBIT = ['dare', 'uscite', 'uscita', 'addebito', 'debit', 'lastschrift', 'belastung', 'soll', 'debito', 'paid out', 'money out', 'debit chf'];
const CREDIT = ['avere', 'entrate', 'entrata', 'accredito', 'credit', 'gutschrift', 'haben', 'credito', 'paid in', 'money in', 'credit chf'];
const has = (h: string, list: string[]) => list.some((k) => h === k || h.startsWith(k + ' ') || h.endsWith(' ' + k) || (k.length > 4 && h.includes(k)));

type Cols = { date: number; desc: number[]; amount: number; debit: number; credit: number };
function headerCols(cells: string[]): Cols | null {
  const hs = cells.map(norm);
  const date = (() => { for (const k of DATE_PRIMARY) { const i = hs.findIndex((h) => h === k || h.startsWith(k + ' ') || h.endsWith(' ' + k)); if (i >= 0) return i; } return -1; })();
  const idx = (list: string[], not: number[] = []) => hs.findIndex((h, i) => !not.includes(i) && has(h, list));
  const debit = idx(DEBIT), credit = idx(CREDIT, [debit]);
  const amount = idx(AMOUNT, [debit, credit, date]);
  const desc = hs.map((h, i) => (i !== date && i !== amount && i !== debit && i !== credit && has(h, DESC) ? i : -1)).filter((i) => i >= 0);
  if (date < 0 || (amount < 0 && debit < 0 && credit < 0)) return null;
  return { date, desc, amount, debit, credit };
}

/** Senza intestazione: colonna con più date, colonna con importi, il resto = descrizione. */
function guessCols(rows: string[][]): Cols | null {
  const n = Math.max(...rows.map((r) => r.length));
  const sample = rows.slice(0, 40);
  const score = (f: (c: string) => boolean) => Array.from({ length: n }, (_, i) => sample.filter((r) => r[i] != null && f(r[i])).length);
  const ds = score((c) => parseDate(c) != null), as = score((c) => parseAmount(c) != null && !/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(c) && /[.,]\d{1,2}$|^-/.test(c.replace(/['’\s]/g, '')));
  const date = ds.indexOf(Math.max(...ds));
  if (date < 0 || ds[date] < 2) return null;
  const amount = as.map((v, i) => (i === date ? -1 : v)).reduce((b, v, i, a) => (v > a[b] ? i : b), 0);
  if (as[amount] < 2) return null;
  const desc = Array.from({ length: n }, (_, i) => i).filter((i) => i !== date && i !== amount && sample.some((r) => /[a-zA-Z]{3}/.test(r[i] ?? '')));
  return { date, desc, amount, debit: -1, credit: -1 };
}

/* ---------- categorie per parole chiave ---------- */
type Rule = { re: RegExp; cats: string[] };
const RULES: Rule[] = [
  { re: /\b(affitto|pigione|locazione|miete|loyer|immobili|verwaltung|regie)\b/, cats: ['Affitto'] },
  { re: /cassa malati|krankenkasse|helsana|css |swica|sanitas|visana|concordia|assura|groupe mutuel|egk|kpt|sympany|oekk|atupri|assicurazione sanitaria/, cats: ['Cassa malati'] },
  { re: /fondo emergenza|emergenza|sparkonto/, cats: ['Fondo emergenza'] },
  { re: /netflix|spotify|disney|apple\.com\/bill|icloud|youtube|amazon prime|dazn|sky |swisscom tv|palestra|fitness|migros fitness|update fitness|abbonament|audible|chatgpt|openai|google one|adobe|microsoft 365|dropbox/, cats: ['Abbonamenti'] },
  { re: /benzin|carburant|tamoil|shell|\bavia\b|\bbp\b|agip|esso|\beni\b|tankstelle|parking|parcheggio|autostrada|vignette|mobility|garage/, cats: ['Trasporti', 'Altro'] },
  { re: /\bsbb\b|\bcff\b|\bffs\b|tpl |arcobaleno|zvv|tarifverbund|bls |postauto|postbus|uber|taxi|flixbus|\btl\b|\btpg\b/, cats: ['Trasporti', 'Abbonamenti', 'Altro'] },
  { re: /migros|coop\b|aldi|lidl|denner|volg|spar |manor food|otto s|farmacia|apotheke|ristorante|restaurant|pizzeria|caffe|café|cafe |bar |mcdonald|starbucks|just eat|uber eats|panetteria|baeckerei|bäckerei|boulangerie|supermercat|elettricit|strom|ewz|aet |internet|swisscom|sunrise|salt |wingo|bolletta|serafe|billag|canone/, cats: ['Alimentari/Casa', 'Altro'] },
  { re: /zara|h&m|h & m|globus|c&a|decathlon|zalando|pkz|scarpe|abbigliament|vestit|bershka|mango|uniqlo|ochsner|footlocker/, cats: ['Abbigliamento'] },
  { re: /booking\.com|airbnb|easyjet|swiss air|swiss international|lufthansa|ryanair|edelweiss|hotel|volo|vacanz|ferien|expedia|hostel|trenitalia|italo/, cats: ['Viaggio estero'] },
];
export function categorize(label: string, available: string[]): string {
  const l = ' ' + label.toLowerCase() + ' ';
  for (const r of RULES) if (r.re.test(l)) { const hit = r.cats.find((c) => available.includes(c)); if (hit) return hit; }
  return available.includes('Altro') ? 'Altro' : available[0] ?? 'Altro';
}

const cleanDesc = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s,;-]+|[\s,;-]+$/g, '');

/** Interpreta il testo di un CSV. `categories` = nomi delle categorie dell'app. Le entrate non hanno categoria. */
export function parseCsv(text: string, categories: string[]): ParseResult {
  const warnings: string[] = [];
  const delimiter = detectDelimiter(text);
  const all = splitCsv(text, delimiter);
  if (!all.length) return { rows: [], delimiter, skipped: 0, warnings: ['Il file è vuoto.'], columns: null };
  let cols: Cols | null = null, start = 0;
  for (let i = 0; i < Math.min(all.length, 25); i++) {
    const c = headerCols(all[i]);
    if (c) { cols = c; start = i + 1; break; }
  }
  if (!cols) { cols = guessCols(all); start = 0; if (cols) warnings.push('Non ho trovato le intestazioni: ho riconosciuto le colonne dal contenuto, controlla l’anteprima.'); }
  if (!cols) return { rows: [], delimiter, skipped: all.length, warnings: ['Non riconosco le colonne. Servono almeno data, descrizione e importo (oppure dare/avere).'], columns: null };
  const hdr = start > 0 ? all[start - 1] : [];
  const rows: CsvRow[] = [];
  let skipped = 0;
  for (let i = start; i < all.length; i++) {
    const r = all[i];
    const date = parseDate(r[cols.date] ?? '');
    let amount: number | null = null;
    if (cols.amount >= 0 && (r[cols.amount] ?? '') !== '') amount = parseAmount(r[cols.amount]);
    if (amount == null && (cols.debit >= 0 || cols.credit >= 0)) {
      const d = cols.debit >= 0 ? parseAmount(r[cols.debit] ?? '') : null;
      const c = cols.credit >= 0 ? parseAmount(r[cols.credit] ?? '') : null;
      if (d != null && d !== 0) amount = -Math.abs(d);
      else if (c != null && c !== 0) amount = Math.abs(c);
    }
    if (!date || amount == null || amount === 0) { skipped++; continue; }
    const parts = cols.desc.map((j) => r[j] ?? '').filter((x) => x && !/^[\d\s.,'’-]+$/.test(x));
    const label = cleanDesc([...new Set(parts)].join(' ')) || 'Movimento';
    rows.push({ date, label, amount: Math.round(amount * 100) / 100, category: amount < 0 ? categorize(label, categories) : null });
  }
  if (!rows.length) warnings.push('Nessun movimento valido trovato nel file.');
  return {
    rows, delimiter, skipped, warnings,
    columns: { date: hdr[cols.date] ?? `col ${cols.date + 1}`, desc: cols.desc.map((j) => hdr[j] ?? `col ${j + 1}`), amount: cols.amount >= 0 ? hdr[cols.amount] ?? `col ${cols.amount + 1}` : null, debit: cols.debit >= 0 ? hdr[cols.debit] ?? null : null, credit: cols.credit >= 0 ? hdr[cols.credit] ?? null : null },
  };
}

/* ---------- duplicati ---------- */
export type ExistingMovement = { monthLabel: string; date: string; amount: number };
const keyOf = (monthLabel: string, ddmm: string, amount: number) => `${monthLabel}|${ddmm}|${Math.round(amount * 100)}`;

/**
 * Separa i movimenti nuovi da quelli già presenti (stesso mese, giorno e importo). Il conteggio è per quantità:
 * se nel file ci sono due pagamenti identici e in app uno solo, ne importa uno.
 */
export function splitDuplicates(rows: CsvRow[], existing: ExistingMovement[]): { fresh: CsvRow[]; duplicates: CsvRow[] } {
  const have = new Map<string, number>();
  existing.forEach((e) => { const k = keyOf(e.monthLabel, e.date, e.amount); have.set(k, (have.get(k) ?? 0) + 1); });
  const fresh: CsvRow[] = [], duplicates: CsvRow[] = [];
  for (const r of rows) {
    const k = keyOf(monthLabelOfIso(r.date), toAppDate(r.date), r.amount);
    const n = have.get(k) ?? 0;
    if (n > 0) { have.set(k, n - 1); duplicates.push(r); } else fresh.push(r);
  }
  return { fresh, duplicates };
}

/** Etichetta salvata nel movimento: "Categoria · descrizione" per le uscite, così l'app la riconosce. */
export function movementLabel(r: CsvRow): string {
  const d = r.label.length > 60 ? r.label.slice(0, 57) + '…' : r.label;
  return r.amount < 0 && r.category ? `${r.category} · ${d}` : d;
}
