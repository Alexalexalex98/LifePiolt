// Google Cloud Translation v2 (Basic). Chiave: GOOGLE_TRANSLATE_API_KEY. (v3/Advanced richiede OAuth e glossari su bucket: non usato.)
import { fetchJson } from '../http.mjs';

const CODES = { zh: 'zh-CN' };
const LANGS = new Set(['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ar', 'ru', 'ja', 'id']);

export function create({ env = process.env } = {}) {
  return {
    name: 'google',
    maskStyle: 'html',
    batchSize: 64,
    concurrency: 4,
    isAvailable: () => !!env.GOOGLE_TRANSLATE_API_KEY,
    supports: (lang) => LANGS.has(lang),
    async translateBatch({ texts, from = 'it', to }) {
      const data = await fetchJson(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(env.GOOGLE_TRANSLATE_API_KEY)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: texts, source: from, target: CODES[to] ?? to, format: 'html' }),
      }, { label: 'Google Translate' });
      const tr = data.data?.translations ?? [];
      return texts.map((_, i) => tr[i]?.translatedText ?? null);
    },
  };
}
export default { create, envKeys: ['GOOGLE_TRANSLATE_API_KEY'] };
