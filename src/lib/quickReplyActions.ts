import { replyTarget, sanitizeReply } from '@/lib/quickReply';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useNet } from '@/store/network';

/** Pubblica la risposta scritta dalla notifica: commento sul post o messaggio nella chat. Ritorna true se è stata inviata. */
export function sendQuickReply(ref: string | undefined, text: unknown): boolean {
  const target = replyTarget(ref);
  const body = sanitizeReply(text);
  if (!target || !body) return false;
  const me = useApp.getState().account.name;
  if (!me) return false;
  if (target.type === 'comment') {
    useNet.getState().addComment(target.postKey, me, body);
    return true;
  }
  const chat = useChat.getState();
  if (!chat.chats[target.chatId]) return false;
  chat.send(target.chatId, me, { kind: 'text', text: body });
  return true;
}
