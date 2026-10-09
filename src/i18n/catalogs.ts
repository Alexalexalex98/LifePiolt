import { registerCatalog } from './core';
import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';

/** Registra tutti i cataloghi (una sola volta). */
let done = false;
export function loadCatalogs() {
  if (done) return;
  done = true;
  const all = { ar, de, en, es, fr, hi, id, ja, pt, ru, zh } as const;
  (Object.keys(all) as (keyof typeof all)[]).forEach((k) => registerCatalog(k, all[k] as Record<string, string>));
}
