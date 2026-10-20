/**
 * Collegare un messaggio al precedente (modulo PURO): «Devo fare la spesa» e poi «mettila nei task» vanno insieme.
 * Qui ci sono solo i riconoscimenti sul testo; la memoria dell'ultimo argomento sta in theiaFlow.
 */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Devo fare la spesa», «ricordami di chiamare Marco», «dovrei prenotare il dentista» → l'argomento («Fare la spesa»). */
export function todoSubject(raw: string): string | null {
  const t = raw.trim().replace(/[.!?]+$/, '');
  const m = /^(?:devo|dovrei|devo assolutamente|ho da|mi tocca|mi serve|ho bisogno di|vorrei|voglio|bisogna|ricordami di|ricordami|ricordati di)\s+(.{3,80})$/i.exec(t);
  if (!m) return null;
  const rest = m[1].trim();
  // dev'essere un'azione («fare…», «chiamare…», «comprare…»): l'infinito finisce in -are/-ere/-ire/-rre/-arsi
  if (!/^(?:\w+(?:are|ere|ire|rre|arsi|ersi|irsi)|\w+(?:arlo|erlo|irlo|arla|erla|irla))\b/i.test(rest)) return null;
  if (/^(?:vedere|guardare|sapere|capire|mostrare|aprire|conoscere|ascoltare|parlare|provare|leggere)\b/i.test(rest)) return null; // sono richieste, non cose da fare
  // «voglio / vorrei / mi serve» valgono come task solo con verbi da fare davvero
  if (/^(?:vorrei|voglio|mi serve|ho bisogno di)\b/i.test(t) && !/^(?:fare|comprare|prenotare|chiamare|pagare|portare|ritirare|spedire|rinnovare|cercare|organizzare|preparare|ordinare)\b/i.test(rest)) return null;
  if (/\b(task|attivit[aà]|promemoria|compito)\b/i.test(rest) && /^(?:mett|aggiung|crea|segn|salv)/i.test(rest)) return null; // «devo mettere la task»: non è l'argomento
  return cap(rest);
}

const VERB = /\b(mett\w*|aggiung\w*|cre\w*|segn\w*|salv\w*|inserisc\w*|scriv\w*|fai\w*|fammi|puoi|potresti|per favore|ti prego|ok|allora|dai|si|sì|devo|voglio|vorrei)\b/g;
const NOUN = /\b(task|tasks|attivita|attività|compito|compiti|promemoria|to do|todo|lista|nei|nel|nella|ai|al|alla|alle|agli|sul|in|a|il|lo|la|l|le|gli|un|una|uno|come|da fare|cose da fare|elenco|anche)\b/g;
/** «Devo mettere la task», «aggiungila ai task», «mettilo nei promemoria», «sì aggiungi»: chiede di salvare l'argomento di prima, senza dirne uno nuovo. */
export function isAddFollowUp(raw: string): boolean {
  const t = fold(raw);
  if (!t || t.split(' ').length > 9) return false;
  const lone = /^(?:si |ok |dai |allora )?(?:mettil[oa]|aggiungil[oa]|segnal[oa]|salval[oa]|inseriscil[oa]|crealo|crea la)\b/.test(t) || /^(?:si|ok|dai)\s+(?:aggiungi|metti|segna|salva)$/.test(t);
  const withNoun = /\b(mett\w*|aggiung\w*|cre\w*|segn\w*|salv\w*|inserisc\w*)\b/.test(t) && /\b(task|tasks|attivita|compito|promemoria|to do|todo|lista|da fare)\b/.test(t);
  if (!lone && !withNoun) return false;
  // se resta una parola che sembra un nuovo argomento («aggiungi task comprare latte») non è un seguito
  const rest = t.replace(VERB, ' ').replace(/\b(mettil[oa]|aggiungil[oa]|segnal[oa]|salval[oa]|inseriscil[oa]|crealo)\b/g, ' ').replace(NOUN, ' ').replace(/\s+/g, ' ').trim();
  return rest.length === 0;
}
