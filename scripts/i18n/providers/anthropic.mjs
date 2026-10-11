// Claude API (https://api.anthropic.com/v1/messages) via fetch. Chiave: ANTHROPIC_API_KEY. Modello: ANTHROPIC_MODEL o --model.
import { fetchJson, ProviderError } from '../http.mjs';
import { LANG_NAMES } from '../catalog.mjs';

export const DEFAULT_MODEL = 'claude-haiku-4-5';

export function buildSystemPrompt({ to, glossary, context }) {
  const g = glossary ?? {};
  const lines = [
    `You are a professional UI localizer. Translate user-interface strings of a mobile life-management app (calendar, tasks, health, finance, chat, social network, AI assistant) from Italian into ${LANG_NAMES[to] ?? to}.`,
    context ? `Context: ${context}` : '',
    '',
    'RULES',
    '- Input is a JSON object {"id": "italian text"}. Output ONLY a JSON object with the same ids and the translated strings. No comments, no code fences.',
    '- Tokens like ⟦0⟧, ⟦1⟧ are protected placeholders (numbers, names, placeholders, commands). Copy each one EXACTLY once, unchanged. You may reorder them if the grammar requires. Never translate, split or add tokens.',
    '- Keep tone friendly and clear; short UI labels (buttons, tabs) stay as short as the original, using the standard app terminology of the target language.',
    g.style?.note ? `- Register: ${g.style.note}` : '',
    '- Keep leading/trailing punctuation and spaces of fragments (e.g. ", for ⟦0⟧"). Singular and plural entries are separate strings: translate each in its own form.',
    '- No emoji, no translator notes, no explanations, no quotes added around the text.',
    '- If a string is a proper name, brand or technical term with no sensible translation, return it unchanged.',
    '- Use the same term for the same Italian word everywhere (see glossary).',
  ].filter((x) => x !== '');
  if (g.terms?.length) {
    lines.push('', 'GLOSSARY (mandatory terms; inflect as the grammar requires):');
    for (const t of g.terms) lines.push(`- "${t.it}" -> "${t.to}"${t.alts?.length ? ` (also acceptable: ${t.alts.join(', ')})` : ''}${t.note ? ` [${t.note}]` : ''}`);
  }
  return lines.join('\n');
}

export function parseJsonObject(text) {
  let s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1) throw new ProviderError('Risposta non JSON dal modello');
  s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e) { throw new ProviderError(`JSON non valido dal modello: ${e.message}`); }
}

export function create({ env = process.env, model } = {}) {
  const mdl = model || env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  return {
    name: 'anthropic',
    model: mdl,
    maskStyle: 'brackets',
    batchSize: 40,
    concurrency: 4,
    isAvailable: () => !!env.ANTHROPIC_API_KEY,
    supports: () => true,
    async translateBatch({ texts, from = 'it', to, glossary, context }) {
      if (from !== 'it') throw new ProviderError('anthropic: sorgente supportata solo it');
      const input = Object.fromEntries(texts.map((t, i) => [String(i + 1), t]));
      const data = await fetchJson('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: mdl,
          max_tokens: 8192,
          temperature: 0,
          system: buildSystemPrompt({ to, glossary, context }),
          messages: [{ role: 'user', content: JSON.stringify(input) }],
        }),
      }, { label: 'Anthropic' });
      const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      const obj = parseJsonObject(text);
      return texts.map((_, i) => (typeof obj[String(i + 1)] === 'string' ? obj[String(i + 1)] : null));
    },
  };
}
export default { create, envKeys: ['ANTHROPIC_API_KEY'] };
