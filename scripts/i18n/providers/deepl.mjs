// DeepL API. Chiave: DEEPL_API_KEY (chiavi gratuite terminano con ":fx" -> api-free.deepl.com, altrimenti api.deepl.com).
// Glossario DeepL opzionale: DEEPL_GLOSSARY_<LANG> (es. DEEPL_GLOSSARY_DE=id del glossario it->de creato nel tuo account).
import { fetchJson, ProviderError } from '../http.mjs';

// Lingue di destinazione DeepL (verificare l'elenco aggiornato con GET /v2/languages?type=target).
// Hindi NON e' nell'elenco: usa un altro provider (catena --provider=deepl,anthropic) oppure DEEPL_EXTRA_LANGS=hi se il tuo piano lo supporta.
const CODES = { en: 'EN-US', es: 'ES', fr: 'FR', de: 'DE', pt: 'PT-BR', zh: 'ZH-HANS', ar: 'AR', ru: 'RU', ja: 'JA', id: 'ID' };
const FORMALITY_OK = new Set(['de', 'es', 'fr', 'pt', 'ja', 'ru']);

export function create({ env = process.env } = {}) {
  const key = env.DEEPL_API_KEY ?? '';
  const base = env.DEEPL_API_URL || (key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com');
  const extra = (env.DEEPL_EXTRA_LANGS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    name: 'deepl',
    maskStyle: 'xml',
    batchSize: 40,
    concurrency: 2,
    isAvailable: () => !!key,
    supports: (lang) => lang in CODES || extra.includes(lang),
    async translateBatch({ texts, from = 'it', to, glossary }) {
      if (!(to in CODES) && !extra.includes(to)) throw new ProviderError(`deepl: lingua ${to} non supportata`, { fatal: false });
      const body = {
        text: texts, source_lang: from.toUpperCase(), target_lang: CODES[to] ?? to.toUpperCase(),
        tag_handling: 'xml', ignore_tags: ['x'], split_sentences: 'nonewlines', preserve_formatting: true,
      };
      const f = glossary?.style?.formality;
      if (f && FORMALITY_OK.has(to)) body.formality = f;
      const gid = env[`DEEPL_GLOSSARY_${to.toUpperCase()}`];
      if (gid) body.glossary_id = gid;
      const data = await fetchJson(`${base}/v2/translate`, {
        method: 'POST', headers: { 'content-type': 'application/json', Authorization: `DeepL-Auth-Key ${key}` }, body: JSON.stringify(body),
      }, { label: 'DeepL' });
      return texts.map((_, i) => data.translations?.[i]?.text ?? null);
    },
  };
}
export default { create, envKeys: ['DEEPL_API_KEY'] };
