/**
 * Formati dipendenti dalla lingua (date, ore, numeri, valuta). Puro: nessun import di react-native o dello store.
 * Le preferenze (formato ora, valuta) sono sincronizzate da setFormatPrefs (root layout) dallo store.
 * Le chiavi di data tecniche (YYYY-MM-DD) non passano di qui.
 */
import { getActive } from './core.ts';
import { infoOf } from './languages.ts';

export const MONEY_NO_DECIMALS = ['JPY', 'IDR', 'KRW'];
/** Valute proposte nelle Impostazioni. */
export const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP', 'JPY', 'CNY', 'INR', 'BRL', 'RUB', 'IDR', 'AED', 'MXN', 'CAD', 'AUD', 'TRY', 'KRW', 'ZAR', 'NGN', 'EGP', 'PKR', 'BDT'];

const prefs = { timeFormat: '24h' as '24h' | '12h', currency: 'CHF' };
export function setFormatPrefs(p: { timeFormat?: '24h' | '12h'; currency?: string }) {
  if (p.timeFormat) prefs.timeFormat = p.timeFormat;
  if (p.currency) prefs.currency = p.currency;
  cache.clear();
}
export const getFormatPrefs = () => ({ ...prefs });
export const currentCurrency = () => prefs.currency;

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

/** Locale BCP-47 della lingua attiva. L'arabo usa cifre latine (i numeri si leggono sempre da sinistra a destra). */
export function currentLocale(): string {
  const info = infoOf(getActive());
  return info.code === 'ar' ? `${info.locale}-u-nu-latn` : info.locale;
}

function dtf(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = 'd|' + locale + '|' + JSON.stringify(opts);
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) { f = new Intl.DateTimeFormat(locale, opts); cache.set(key, f); }
  return f;
}
function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = 'n|' + locale + '|' + JSON.stringify(opts);
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) { f = new Intl.NumberFormat(locale, opts); cache.set(key, f); }
  return f;
}
const toDate = (d: Date | number | string) => (d instanceof Date ? d : new Date(d));

/** Data/ora con le opzioni di Intl.DateTimeFormat nella lingua attiva (rispetta il formato 24h/12h se c'è l'ora). */
export function fmtDate(d: Date | number | string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }, locale = currentLocale()): string {
  const o = { ...opts };
  if ((o.hour || o.timeStyle) && o.hour12 === undefined && o.hourCycle === undefined) o.hour12 = prefs.timeFormat === '12h';
  try { return dtf(locale, o).format(toDate(d)); } catch { return toDate(d).toISOString(); }
}

/** Solo ora ("14:30" oppure "2:30 PM"). */
export function fmtTime(d: Date | number | string, locale = currentLocale()): string {
  return fmtDate(d, { hour: prefs.timeFormat === '12h' ? 'numeric' : '2-digit', minute: '2-digit' }, locale);
}

/** Data breve + ora, ad es. "09/10, 14:30". */
export function fmtDateTime(d: Date | number | string, locale = currentLocale()): string {
  return fmtDate(d, { day: '2-digit', month: '2-digit', hour: prefs.timeFormat === '12h' ? 'numeric' : '2-digit', minute: '2-digit' }, locale);
}

export function fmtNumber(n: number, opts: Intl.NumberFormatOptions = {}, locale = currentLocale()): string {
  if (!Number.isFinite(n)) return String(n);
  try { return nf(locale, opts).format(n); } catch { return String(n); }
}

/** Intero raggruppato (punti LifePoints, passi, ecc.). */
export const fmtInt = (n: number, locale = currentLocale()) => fmtNumber(Math.round(n), { maximumFractionDigits: 0 }, locale);

export type MoneyOpts = { currency?: string; decimals?: number; sign?: boolean; locale?: string };
/** Importo nella valuta scelta; senza decimali (come prima) salvo `decimals`. JPY/IDR/KRW sempre senza decimali. `sign` aggiunge + davanti ai positivi. */
export function formatMoney(n: number, opts: MoneyOpts = {}): string {
  const currency = opts.currency ?? prefs.currency;
  const locale = opts.locale ?? currentLocale();
  const dec = MONEY_NO_DECIMALS.includes(currency) ? 0 : opts.decimals ?? 0;
  let s: string;
  try {
    s = nf(locale, { style: 'currency', currency, minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  } catch {
    s = `${fmtNumber(n, { minimumFractionDigits: dec, maximumFractionDigits: dec }, locale)} ${currency}`;
  }
  return opts.sign && n > 0 ? '+' + s : s;
}

/** Sola cifra (nessun simbolo), per grafici e totali: "1'234" -> "1,234" a seconda della lingua. */
export const fmtAmount = (n: number, decimals = 0, locale = currentLocale()) => fmtNumber(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }, locale);

/** Simbolo/codice della valuta scelta ("CHF", "€", "$"). */
export function currencyLabel(currency = prefs.currency, locale = currentLocale()): string {
  try { return nf(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency; } catch { return currency; }
}

/** Nome del mese (0 = gennaio) nella lingua attiva, iniziale maiuscola solo se la lingua la usa. */
export function monthName(i: number, locale = currentLocale()): string {
  return dtf(locale, { month: 'long' }).format(new Date(2024, ((i % 12) + 12) % 12, 1));
}
export function monthShort(i: number, locale = currentLocale()): string {
  return dtf(locale, { month: 'short' }).format(new Date(2024, ((i % 12) + 12) % 12, 1));
}
/** Giorno della settimana, 0 = domenica (come Date.getDay). */
export function weekdayShort(i: number, locale = currentLocale()): string {
  return dtf(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + (((i % 7) + 7) % 7)));
}
export function weekdayLong(i: number, locale = currentLocale()): string {
  return dtf(locale, { weekday: 'long' }).format(new Date(2024, 0, 7 + (((i % 7) + 7) % 7)));
}
export function weekdayNarrow(i: number, locale = currentLocale()): string {
  return dtf(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + (((i % 7) + 7) % 7)));
}

const IT_MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const IT_RE = new RegExp('\\b(' + IT_MONTHS.join('|') + ')\\b', 'gi');
/** Sostituisce i nomi di mese italiani dentro un'etichetta salvata ("Ottobre 2026") con quelli della lingua attiva. Solo per la visualizzazione. */
export function localizeMonths(label: string): string {
  if (getActive() === 'it' || !label) return label;
  return label.replace(IT_RE, (m) => {
    const name = monthName(IT_MONTHS.indexOf(m.toLowerCase()));
    return m[0] === m[0].toUpperCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
  });
}
