import { t } from '@/i18n/core';
import { aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { askSend, logSend } from '@/lib/aiConsent';
import { BUILDER_PROMPT, parseBuilderReply, type Spec } from './spec';
import type { CreationMsg } from '@/store/creations';

/** Chiede all'AI di creare o modificare la scheda demo. Manda solo il testo della conversazione: niente dati personali dell'app. */
export async function askBuilder(chat: CreationMsg[], spec: Spec | null): Promise<{ text: string; spec: Spec | null }> {
  if (!aiServerConfigured) return { text: t('Per creare serve il collegamento con l\'AI: lo attivi in Intelligenza di Theia. Intanto dimmi l\'idea, la tengo qui.'), spec: null };
  if (!(await askSend('data', t('Il testo di quello che mi scrivi qui per creare la scheda. Nessun altro dato dell\'app.')))) return { text: t('Va bene, non invio niente. Quando vuoi, ne riparliamo: la tua idea resta qui.'), spec: null };
  const talk = chat.slice(-12).map((m) => `${m.who === 'me' ? 'Utente' : 'Assistente'}: ${m.text}`).join('\n');
  const cur = spec ? `\nScheda attuale (modificala se serve, altrimenti rifalla): ${JSON.stringify(spec)}` : '';
  logSend('data', talk.length, [t('idea per una scheda')]);
  const reply = await aiChatRaw(`${BUILDER_PROMPT}${cur}\n\nConversazione:\n${talk}\nAssistente:`);
  const r = parseBuilderReply(reply);
  return { text: r.text || t('Ecco una prima idea: guardala qui sotto e dimmi cosa cambiare.'), spec: r.spec ?? spec };
}
