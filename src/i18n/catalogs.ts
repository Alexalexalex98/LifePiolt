import { registerCatalog } from './core';
import ar from './locales/ar.json';
import arOv from './overrides/ar.json';
import de from './locales/de.json';
import deOv from './overrides/de.json';
import en from './locales/en.json';
import enOv from './overrides/en.json';
import es from './locales/es.json';
import esOv from './overrides/es.json';
import fr from './locales/fr.json';
import frOv from './overrides/fr.json';
import hi from './locales/hi.json';
import hiOv from './overrides/hi.json';
import id from './locales/id.json';
import idOv from './overrides/id.json';
import ja from './locales/ja.json';
import jaOv from './overrides/ja.json';
import pt from './locales/pt.json';
import ptOv from './overrides/pt.json';
import ru from './locales/ru.json';
import ruOv from './overrides/ru.json';
import zh from './locales/zh.json';
import zhOv from './overrides/zh.json';

/** Registra tutti i cataloghi (una sola volta). */
let done = false;
export function loadCatalogs() {
  if (done) return;
  done = true;
  const all = { ar, de, en, es, fr, hi, id, ja, pt, ru, zh } as const;
  // Correzioni manuali (src/i18n/overrides/<lang>.json): hanno la precedenza sulle traduzioni automatiche e il runner non le sovrascrive.
  const overrides = { ar: arOv, de: deOv, en: enOv, es: esOv, fr: frOv, hi: hiOv, id: idOv, ja: jaOv, pt: ptOv, ru: ruOv, zh: zhOv } as const;
  (Object.keys(all) as (keyof typeof all)[]).forEach((k) =>
    registerCatalog(k, { ...(all[k] as Record<string, string>), ...(overrides[k] as Record<string, string>) }));
}
