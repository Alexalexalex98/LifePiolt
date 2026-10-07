import { useChat } from '@/store/chat';

const replies = ['Perfetto, grazie!', 'Ricevuto 👍', 'Ci penso e ti scrivo dopo.', 'Ottima idea!', 'Ok, ci sentiamo domani.', 'Fantastico 🙌', 'Va bene per me.', 'Dammi un attimo e ti rispondo.'];

/**
 * Solo modalità demo: simula consegna/lettura e una risposta, perché senza server di messaggistica
 * nessuno risponde davvero. Nella modalità reale lo stato resta "inviato".
 */
export function simulateDelivery(chatId: string, mid: string, from: string, withReply: boolean) {
  const { patchMsg, receive, settings } = useChat.getState();
  setTimeout(() => patchMsg(chatId, mid, { status: 'delivered' }), 1200);
  if (settings.readReceipts) setTimeout(() => patchMsg(chatId, mid, { status: 'read' }), 3200);
  if (withReply) setTimeout(() => {
    const c = useChat.getState().chats[chatId];
    if (!c) return;
    receive(chatId, from, { kind: 'text', text: replies[Math.floor(Math.random() * replies.length)] });
  }, 6500);
}
