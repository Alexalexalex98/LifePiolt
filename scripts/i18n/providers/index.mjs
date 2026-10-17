// Registro dei provider e scelta automatica (primo con chiave disponibile).
import anthropic from './anthropic.mjs';
import deepl from './deepl.mjs';
import google from './google.mjs';
import libretranslate from './libretranslate.mjs';
import manual from './manual.mjs';
import mock from './mock.mjs';
import none from './none.mjs';

export const REGISTRY = { anthropic, deepl, google, libretranslate, manual, mock, none };
export const AUTO_ORDER = ['anthropic', 'deepl', 'google', 'libretranslate'];

export const NO_KEY_MESSAGE =
  'Nessun motore di traduzione configurato. Imposta ANTHROPIC_API_KEY o DEEPL_API_KEY (oppure GOOGLE_TRANSLATE_API_KEY, LIBRETRANSLATE_URL) ' +
  'nell\'ambiente o in .env.local (vedi docs/i18n.md). Per provare senza chiavi: --provider=mock.';

/** spec: "auto" | "deepl" | "deepl,anthropic". Restituisce la catena di provider istanziati (ordine di preferenza). */
export function buildChain(spec, { env = process.env, model } = {}) {
  const names = !spec || spec === 'auto' ? AUTO_ORDER.filter((n) => REGISTRY[n].create({ env }).isAvailable()) : spec.split(',').map((s) => s.trim()).filter(Boolean);
  const chain = [];
  for (const n of names) {
    const entry = REGISTRY[n];
    if (!entry) throw new Error(`Provider sconosciuto: ${n} (disponibili: ${Object.keys(REGISTRY).join(', ')})`);
    const p = entry.create({ env, model });
    if (!p.isAvailable()) throw new Error(`Provider ${n}: chiave mancante (${entry.envKeys.join(' / ')}). Vedi docs/i18n.md.`);
    p.reportOnly = !!entry.reportOnly;
    chain.push(p);
  }
  return chain;
}

/** Primo provider della catena che supporta la lingua (o null). */
export const providerFor = (chain, lang) => chain.find((p) => p.supports(lang)) ?? null;
