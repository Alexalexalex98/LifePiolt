import type { ChatMsg } from '@/store';

/**
 * L'assistente deve parlare con il TUO backend (che tiene la chiave API Anthropic).
 * Mai mettere chiavi API dentro l'app: chiunque potrebbe estrarle dal pacchetto.
 *
 * Contratto atteso:  POST {EXPO_PUBLIC_API_URL}/chat
 *   body: { messages: { role: 'user' | 'assistant'; text: string }[] }
 *   risposta: { reply: string }
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const aiConfigured = Boolean(API_URL);

export async function askAssistant(history: ChatMsg[]): Promise<string> {
  if (!API_URL) {
    return 'L\'assistente AI non è ancora collegato a un server. Imposta EXPO_PUBLIC_API_URL per attivarlo.';
  }
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: history.slice(-20).map(({ role, text }) => ({ role, text })) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { reply?: string };
  return data.reply ?? 'Risposta vuota dal server.';
}
