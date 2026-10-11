// LibreTranslate (gratuito, auto-ospitabile). LIBRETRANSLATE_URL (es. http://localhost:5000), LIBRETRANSLATE_KEY opzionale.
// La qualita' dei modelli open e' inferiore: i token di protezione che tornano malformati vengono scartati dal runner (voce 'fallita').
import { fetchJson } from '../http.mjs';

const LANGS = new Set(['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ar', 'ru', 'ja', 'id']);

export function create({ env = process.env } = {}) {
  const url = (env.LIBRETRANSLATE_URL ?? '').replace(/\/+$/, '');
  return {
    name: 'libretranslate',
    maskStyle: 'xml',
    batchSize: 20,
    concurrency: 1,
    isAvailable: () => !!url,
    supports: (lang) => LANGS.has(lang),
    async translateBatch({ texts, from = 'it', to }) {
      const body = { q: texts, source: from, target: to === 'zh' ? env.LIBRETRANSLATE_ZH_CODE || 'zh' : to, format: 'html' };
      if (env.LIBRETRANSLATE_KEY) body.api_key = env.LIBRETRANSLATE_KEY;
      const data = await fetchJson(`${url}/translate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, { label: 'LibreTranslate' });
      const tr = data.translatedText;
      if (Array.isArray(tr)) return texts.map((_, i) => (typeof tr[i] === 'string' ? tr[i] : null));
      return texts.map((_, i) => (texts.length === 1 && i === 0 && typeof tr === 'string' ? tr : null));
    },
  };
}
export default { create, envKeys: ['LIBRETRANSLATE_URL'] };
