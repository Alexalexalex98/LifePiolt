/** Adatta il tono delle risposte dell'assistente allo stile scelto nel Profilo. Puro: nessuna AI. */
import { t } from '../../i18n/core.ts';

export type Style = 'diretto' | 'discorsivo' | 'breve';

const TIP = /^(se preferisci|se vuoi|puoi |per togliere|lo trovi|ricorda|dimmi |scegli un|if you prefer|if you want|you can |to remove|you'll find|remember|tell me |choose one)/i;
const ACTION = /^(fatto|aggiunto|aggiunta|ho |spostato|registrato|annullato|rinominato|segnato|nuovo|done|added|moved|recorded|undone|renamed|marked|i )/i;

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

export function styleText(text: string, style: Style): string {
  if (!text || style === 'diretto') return text;
  if (style === 'breve') {
    const lines = text.split('\n');
    if (lines.length > 1) {
      // elenco: titolo + al massimo 3 righe
      const head = lines.filter((l) => l.trim());
      return head.length > 4 ? [...head.slice(0, 4), t('…e altre {0} righe', head.length - 4)].join('\n') : text;
    }
    if (text.length <= 140) return text;
    const keep = sentences(text).filter((s, i) => i === 0 || !TIP.test(s.trim()));
    return keep.slice(0, 2).join(' ').replace(/\s*\([^)]*\)/g, '').trim();
  }
  // discorsivo
  let out = text;
  const closing = t('Se qualcosa non ti convince, dimmelo e lo cambio o lo annullo.');
  const low = text.charAt(0).toLowerCase() + text.slice(1);
  if (ACTION.test(text) && !/^(certo|sure)/i.test(text)) out = t('Certo, {0}', low);
  else if (!/^(certo|ecco|allora|sure|here|well)/i.test(text) && !text.includes('\n') && text.length < 120) out = t('Ecco: {0}', low);
  if (ACTION.test(text) && !out.includes(closing) && !out.includes('\n')) out += ' ' + closing;
  return out;
}
