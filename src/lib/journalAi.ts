import { t } from '@/i18n/core';
import { askSend, logSend } from '@/lib/aiConsent';
import { AiServerError, aiChatRaw, aiServerConfigured } from '@/lib/aiServer';
import { entryText } from '@/lib/journalCore';
import { useJournal } from '@/store/journal';

/**
 * Analisi più profonda fatta da Theia sulle pagine scelte. Theia NON risponde alla persona nel diario:
 * produce solo un'analisi (umore, andamento, temi, relazioni). Parte solo dopo un consenso esplicito, ogni volta.
 */
export async function deepAnalysis(from: string, to: string): Promise<{ ok: boolean; text: string }> {
  const list = Object.values(useJournal.getState().entries).filter((e) => e.day >= from && e.day <= to).sort((a, b) => a.day.localeCompare(b.day));
  const body = list.map((e) => `[${e.day}]\n${entryText(e)}`).join('\n\n').slice(0, 12000);
  if (body.trim().length < 40) return { ok: false, text: t('Ci sono poche pagine in questo periodo: scrivi ancora qualcosa e riprova.') };
  if (!aiServerConfigured) return { ok: false, text: t('Per questa analisi serve il collegamento con l\'AI: lo attivi in Intelligenza di Theia.') };
  if (!(await askSend('data', t('Il testo delle pagine del diario di questo periodo, solo per farne l\'analisi. Nient\'altro: nessun dato personale dell\'app e nessuna chat. Il diario resta sul telefono.')))) return { ok: false, text: t('Va bene, non invio niente. Il diario resta sul telefono.') };
  logSend('data', body.length, ['diario']);
  try {
    const r = await aiChatRaw(`Sei Theia. Qui sotto ci sono le pagine di un diario personale. NON rispondere alla persona e NON darle consigli medici o diagnosi: scrivi solo un'analisi in italiano, con tono gentile, positivo e propositivo, in massimo 200 parole, con queste quattro parti brevi: "Stato d'animo" (com'è andato e se cambia nel tempo), "Temi" (cosa ricorre), "Relazioni" (come vengono vissute le persone citate), "Spunti" (due idee piccole e concrete su cosa potrebbe farle bene). Se emerge un segnale di forte sofferenza, di' con delicatezza che parlarne con un professionista o con una persona fidata può aiutare.\n\n${body}`);
    const text = r.trim(); if (!text) return { ok: false, text: t('Risposta vuota dal server.') };
    useJournal.getState().addReport({ from, to, text });
    return { ok: true, text };
  } catch (e) { return { ok: false, text: e instanceof AiServerError ? e.message : t('Dammi un attimo e riproviamo.') }; }
}
