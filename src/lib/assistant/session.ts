/**
 * Quando riparte, la chat con Theia riparte DA ZERO: lei non ricorda le conversazioni passate.
 * Il passato entra solo se tocchi «Storico» E la domanda c'entra con quello che c'era scritto.
 */
import { similarity } from './nlp.ts';

export type LogMsg = { who: 'me' | 'ai'; text: string; ts: number };
const GAP = 2 * 3600000;

/** Dove comincia la conversazione di adesso: dopo una pausa di piu' di due ore se ne apre una nuova. */
export function sessionFromOf(log: LogMsg[], now = Date.now()): number {
  if (!log.length) return 0;
  if (now - log[log.length - 1]!.ts > GAP) return log.length;
  let i = log.length - 1;
  while (i > 0 && log[i]!.ts - log[i - 1]!.ts < GAP) i--;
  return i;
}

let historyOpen = false;
/** L'utente ha toccato «Storico»: la cronologia vecchia puo' essere ripresa (ma solo se la domanda e' pertinente). */
export const setHistoryOpen = (v: boolean) => { historyOpen = v; };
export const isHistoryOpen = () => historyOpen;

/** Scambi (domanda + risposta) delle conversazioni passate che c'entrano con la domanda di adesso. Senza «Storico» o senza pertinenza: nessuno. */
export function relevantHistory(log: LogMsg[], question: string, open = historyOpen, now = Date.now(), max = 3): LogMsg[][] {
  if (!open) return [];
  const from = sessionFromOf(log, now);
  const old = log.slice(0, from);
  const pairs: { msgs: LogMsg[]; score: number }[] = [];
  for (let i = 0; i < old.length; i++) {
    if (old[i]!.who !== 'me') continue;
    const msgs = [old[i]!]; const next = old[i + 1]; if (next && next.who === 'ai') msgs.push(next);
    const score = similarity(question, old[i]!.text);
    if (score >= 0.34) pairs.push({ msgs, score });
  }
  return pairs.sort((a, b) => b.score - a.score || b.msgs[0]!.ts - a.msgs[0]!.ts).slice(0, max).map((p) => p.msgs);
}
