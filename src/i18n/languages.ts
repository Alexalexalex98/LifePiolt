/** Lingue supportate. Il testo sorgente dell'app è l'italiano: le altre sono traduzioni a catalogo. */
export type LangCode = 'it' | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'hi' | 'ar' | 'ru' | 'ja' | 'id';

export type LangInfo = { code: LangCode; native: string; english: string; locale: string; rtl: boolean; currency: string };

export const LANGUAGES: LangInfo[] = [
  { code: 'it', native: 'Italiano', english: 'Italian', locale: 'it-IT', rtl: false, currency: 'CHF' },
  { code: 'en', native: 'English', english: 'English', locale: 'en-GB', rtl: false, currency: 'USD' },
  { code: 'es', native: 'Español', english: 'Spanish', locale: 'es-ES', rtl: false, currency: 'EUR' },
  { code: 'fr', native: 'Français', english: 'French', locale: 'fr-FR', rtl: false, currency: 'EUR' },
  { code: 'de', native: 'Deutsch', english: 'German', locale: 'de-DE', rtl: false, currency: 'EUR' },
  { code: 'pt', native: 'Português', english: 'Portuguese', locale: 'pt-BR', rtl: false, currency: 'BRL' },
  { code: 'zh', native: '简体中文', english: 'Chinese (Simplified)', locale: 'zh-CN', rtl: false, currency: 'CNY' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', locale: 'hi-IN', rtl: false, currency: 'INR' },
  { code: 'ar', native: 'العربية', english: 'Arabic', locale: 'ar-EG', rtl: true, currency: 'USD' },
  { code: 'ru', native: 'Русский', english: 'Russian', locale: 'ru-RU', rtl: false, currency: 'RUB' },
  { code: 'ja', native: '日本語', english: 'Japanese', locale: 'ja-JP', rtl: false, currency: 'JPY' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', locale: 'id-ID', rtl: false, currency: 'IDR' },
];

export const LANG_CODES = LANGUAGES.map((l) => l.code);
export const infoOf = (c: string): LangInfo => LANGUAGES.find((l) => l.code === c) ?? LANGUAGES[0];

/** Vecchi nomi salvati nelle versioni precedenti dell'app -> codice. */
const OLD: Record<string, LangCode> = { Italiano: 'it', English: 'en', Deutsch: 'de', 'Français': 'fr' };

export function normalizeLang(v: unknown): LangCode {
  if (typeof v === 'string') {
    if ((LANG_CODES as string[]).includes(v)) return v as LangCode;
    if (OLD[v]) return OLD[v];
  }
  return 'it';
}

/** Dal tag del telefono ("zh-Hans-CN", "pt_BR", "ar") alla lingua supportata più vicina. Se non supportata: inglese. */
export function detectLang(tag: string | undefined | null): LangCode {
  const base = String(tag ?? '').toLowerCase().replace('_', '-').split('-')[0];
  return (LANG_CODES as string[]).includes(base) ? (base as LangCode) : 'en';
}
