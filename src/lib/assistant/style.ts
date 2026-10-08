/** Adatta il tono delle risposte dell'assistente allo stile scelto nel Profilo. Puro: nessuna AI. */
export type Style = 'diretto' | 'discorsivo' | 'breve';

const TIP = /^(se preferisci|se vuoi|puoi |per togliere|lo trovi|ricorda|dimmi |scegli un)/i;
const ACTION = /^(fatto|aggiunto|aggiunta|ho |spostato|registrato|annullato|rinominato|segnato|nuovo)/i;
const CLOSING = 'Se qualcosa non ti convince, dimmelo e lo cambio o lo annullo.';

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

export function styleText(text: string, style: Style): string {
  if (!text || style === 'diretto') return text;
  if (style === 'breve') {
    const lines = text.split('\n');
    if (lines.length > 1) {
      // elenco: titolo + al massimo 3 righe
      const head = lines.filter((l) => l.trim());
      return head.length > 4 ? [...head.slice(0, 4), `…e altre ${head.length - 4} righe`].join('\n') : text;
    }
    if (text.length <= 140) return text;
    const keep = sentences(text).filter((s, i) => i === 0 || !TIP.test(s.trim()));
    return keep.slice(0, 2).join(' ').replace(/\s*\([^)]*\)/g, '').trim();
  }
  // discorsivo
  let out = text;
  if (ACTION.test(text) && !/^certo/i.test(text)) out = 'Certo, ' + text.charAt(0).toLowerCase() + text.slice(1);
  else if (!/^(certo|ecco|allora)/i.test(text) && !text.includes('\n') && text.length < 120) out = 'Ecco: ' + text.charAt(0).toLowerCase() + text.slice(1);
  if (ACTION.test(text) && !out.includes(CLOSING) && !out.includes('\n')) out += ' ' + CLOSING;
  return out;
}
