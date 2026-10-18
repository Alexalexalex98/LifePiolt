/**
 * Come parla Theia: come una persona, non come un'AI, e si adatta a chi ha davanti (modulo PURO).
 * `styleHints` guarda come scrive l'utente (lei/tu, lunghezza, tono) e dà le istruzioni al modello; `humanize` toglie dalla risposta
 * i segni da chat-bot (**grassetto**, elenchi con l'asterisco, titoli) che nell'app comparivano così come sono.
 */
const words = (s: string) => (s.match(/\p{L}[\p{L}'’]*/gu) ?? []).length;

export type Style = { formal: boolean; length: 'brevissima' | 'breve' | 'media' | 'lunga'; casual: boolean; warm: boolean; lang?: string };

export function readStyle(userTexts: string[]): Style {
  const t = userTexts.map((x) => x.trim()).filter(Boolean).slice(-8);
  if (!t.length) return { formal: false, length: 'breve', casual: false, warm: false };
  const all = t.join(' ');
  const formal = /\b(lei|la ringrazio|potrebbe|potrebbero|mi pu[oò]|gentilmente|cordiali|distinti|buongiorno,)\b/i.test(all) && !/\b(tu|dimmi|puoi|ciao)\b/i.test(all);
  const avg = t.reduce((s, x) => s + words(x), 0) / t.length;
  const length = avg < 5 ? 'brevissima' : avg < 12 ? 'breve' : avg < 30 ? 'media' : 'lunga';
  const lowerStarts = t.filter((x) => /^[a-zà-ÿ]/.test(x)).length;
  const noPunct = t.filter((x) => !/[.!?]$/.test(x)).length;
  const casual = lowerStarts / t.length > 0.6 && noPunct / t.length > 0.6;
  const warm = /(!{1,}|\b(ahah|haha|grazie mille|grande|top|perfetto|bellissim)\w*)/i.test(all);
  return { formal, length, casual, warm };
}

/** Le istruzioni sul modo di rispondere, dette al modello. */
export function styleHints(userTexts: string[]): string {
  const s = readStyle(userTexts);
  const lines = [
    'Scrivi come una persona che conosce bene l\'utente, non come un assistente AI: niente «Certamente!», niente «Come intelligenza artificiale», niente titoli, niente elenchi puntati a meno che servano davvero, niente grassetto né simboli di markdown, niente emoji.',
    'Frasi naturali, dirette e calde; vai al punto prima e spiega dopo solo se serve.',
    s.formal ? 'L\'utente scrive in modo formale: dagli del «lei» e resta educato e sobrio.' : 'Dagli del «tu» e usa un tono amichevole, come tra conoscenti.',
    s.length === 'brevissima' ? 'L\'utente scrive messaggi brevissimi: rispondi in una o due frasi, al massimo.' : s.length === 'breve' ? 'L\'utente scrive messaggi brevi: rispondi breve (2-4 frasi).' : s.length === 'media' ? 'Rispondi in modo completo ma compatto (un paio di brevi paragrafi).' : 'L\'utente scrive messaggi articolati: puoi rispondere in modo più completo e ragionato, sempre ordinato.',
    s.casual ? 'L\'utente scrive in modo molto colloquiale: usa un registro rilassato e parlato, frasi corte, senza essere sciatto.' : '',
    s.warm ? 'L\'utente è espansivo: rispondi con calore e un po\' di entusiasmo, senza esagerare.' : '',
    'Rispondi nella stessa lingua in cui scrive l\'utente.',
    'Se ti manca un dato, chiedilo con una domanda sola, breve. Non inventare mai informazioni.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Toglie i segni da chat-bot dalla risposta. */
export function humanize(text: string): string {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/```[a-z]*\n?|```/gi, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
    .replace(/^\s*[*•-]\s+/gm, '– ')
    .replace(/^(\s*)–\s+–\s+/gm, '$1– ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
