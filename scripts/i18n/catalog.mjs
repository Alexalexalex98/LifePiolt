// Lettura/scrittura dei cataloghi (stesso formato dei file esistenti: indent 0, no ASCII escape, senza newline finale).
import fs from 'node:fs';
import path from 'node:path';

export const LANGS = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ar', 'ru', 'ja', 'id'];
export const LANG_NAMES = {
  en: 'English', es: 'Spanish (neutral, Latin America/Spain)', fr: 'French', de: 'German', pt: 'Portuguese (Brazil)',
  zh: 'Simplified Chinese', hi: 'Hindi (Devanagari)', ar: 'Modern Standard Arabic', ru: 'Russian', ja: 'Japanese', id: 'Indonesian',
};

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; }
}

export function serialize(cat) {
  const keys = Object.keys(cat);
  return '{\n' + keys.map((k) => JSON.stringify(k) + ': ' + JSON.stringify(cat[k])).join(',\n') + '\n}';
}

/** Scrittura atomica: file temporaneo nella stessa cartella + rename. */
export function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export const saveCatalog = (file, cat) => writeAtomic(file, serialize(cat));

/** Ordina le chiavi come nel sorgente (le chiavi non nel sorgente in coda, ordine originale). */
export function sortLikeSource(cat, source) {
  const out = {};
  for (const k of source) if (k in cat) out[k] = cat[k];
  for (const k of Object.keys(cat)) if (!(k in out)) out[k] = cat[k];
  return out;
}

/**
 * Confronta sorgente e catalogo.
 * - missing: chiavi del sorgente senza traduzione (e senza override)
 * - orphans: chiavi del catalogo non piu' nel sorgente
 * - invalid: traduzioni presenti ma vuote o con segnaposto diversi (da rifare)
 * - redo: chiavi che corrispondono a --retranslate
 */
export function planLang({ source, catalog, overrides = {}, retranslate = null, invalidFn = null }) {
  const srcSet = new Set(source);
  const missing = [];
  const invalid = [];
  const redo = [];
  for (const k of source) {
    if (k in overrides) continue;
    if (!(k in catalog)) { missing.push(k); continue; }
    if (invalidFn && invalidFn(k, catalog[k])) { invalid.push(k); continue; }
    if (retranslate && retranslate.test(k)) redo.push(k);
  }
  const orphans = Object.keys(catalog).filter((k) => !srcSet.has(k));
  return { missing, orphans, invalid, redo };
}
