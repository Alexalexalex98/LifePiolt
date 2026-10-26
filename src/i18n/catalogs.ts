import { registerCatalog } from './core';
import type { LangCode } from './languages';

/** Un catalogo per volta: i 11 file valgono circa 10 MB e costruire gli indici di tutti all'avvio rallentava ogni apertura dell'app. `require` dentro la funzione: il file si legge solo se serve. */
const loaded = new Set<string>();
function readCatalog(lang: string): { base: Record<string, string>; ov: Record<string, string> } | null {
  /* eslint-disable @typescript-eslint/no-require-imports */
  switch (lang) {
    case 'ar': return { base: require('./locales/ar.json'), ov: require('./overrides/ar.json') };
    case 'de': return { base: require('./locales/de.json'), ov: require('./overrides/de.json') };
    case 'en': return { base: require('./locales/en.json'), ov: require('./overrides/en.json') };
    case 'es': return { base: require('./locales/es.json'), ov: require('./overrides/es.json') };
    case 'fr': return { base: require('./locales/fr.json'), ov: require('./overrides/fr.json') };
    case 'hi': return { base: require('./locales/hi.json'), ov: require('./overrides/hi.json') };
    case 'id': return { base: require('./locales/id.json'), ov: require('./overrides/id.json') };
    case 'ja': return { base: require('./locales/ja.json'), ov: require('./overrides/ja.json') };
    case 'pt': return { base: require('./locales/pt.json'), ov: require('./overrides/pt.json') };
    case 'ru': return { base: require('./locales/ru.json'), ov: require('./overrides/ru.json') };
    case 'zh': return { base: require('./locales/zh.json'), ov: require('./overrides/zh.json') };
    default: return null;
  }
}

/** Carica il catalogo di una lingua (l'italiano è il testo originale e non ne ha). Le correzioni manuali (overrides) hanno la precedenza sulle traduzioni automatiche. */
export function loadCatalog(lang: LangCode) {
  if (loaded.has(lang)) return;
  const c = readCatalog(lang);
  if (!c) return;
  loaded.add(lang);
  // L'inglese è la lingua principale: le frasi non ancora tradotte in questa lingua escono in inglese, non in italiano.
  const en = lang === 'en' ? null : readCatalog('en');
  registerCatalog(lang, { ...(en ? { ...(en.base as Record<string, string>), ...(en.ov as Record<string, string>) } : {}), ...(c.base as Record<string, string>), ...(c.ov as Record<string, string>) });
}

/** Tutti i cataloghi (serve solo a strumenti e prove). */
export function loadCatalogs() {
  for (const l of ['ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'ja', 'pt', 'ru', 'zh'] as const) loadCatalog(l);
}
