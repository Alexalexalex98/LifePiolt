/**
 * Risposta rapida dalla notifica, senza aprire l'app (modulo PURO).
 * Su una notifica di commento, menzione o messaggio compare «Rispondi»: il testo scritto nella notifica diventa un commento sul post
 * (o un messaggio nella chat) senza entrare nell'app.
 */
import { parseRef, postOf } from './notifyLinks.ts';

export const REPLY_CATEGORY = 'lp-reply';
export const REPLY_ACTION = 'reply';
export const REPLY_MAX = 500;

export type ReplyTarget = { type: 'comment'; postKey: string } | { type: 'chat'; chatId: string };

/** A cosa si risponde da questa notifica; null se non si può rispondere (like, follow, promemoria...). */
export function replyTarget(ref: string | null | undefined): ReplyTarget | null {
  const post = postOf(ref);
  if (post) return { type: 'comment', postKey: post };
  const p = parseRef(ref);
  if (p?.kind === 'chat' && p.args[0]) return { type: 'chat', chatId: p.args[0] };
  return null;
}
export const canReply = (ref: string | null | undefined): boolean => replyTarget(ref) !== null;

/** Testo pulito della risposta; null se vuoto. */
export function sanitizeReply(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const s = text.replace(/\s+/g, ' ').trim().slice(0, REPLY_MAX);
  return s ? s : null;
}
