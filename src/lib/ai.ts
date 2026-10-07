import type { ChatMsg } from '@/store/life';

/**
 * L'assistente completo deve parlare con il TUO backend (che custodisce la chiave API).
 * Mai mettere chiavi API dentro l'app: chiunque potrebbe estrarle dal pacchetto.
 *
 * Contratto atteso:  POST {EXPO_PUBLIC_API_URL}/chat
 *   body:     { topic: string, messages: { who: 'me' | 'ai'; text: string }[] }
 *   risposta: { reply: string }
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const aiConfigured = Boolean(API_URL);

export const categories = ['General', 'Business', 'Finance', 'Health', 'Fitness', 'Study', 'Mind', 'Casa', 'Viaggi', 'Legal'];

export const catReplies: Record<string, string> = {
  General: 'Posso organizzare la giornata, collegare obiettivi e note, o rispondere su qualsiasi area della tua vita.',
  Business: 'Agente Business: posso preparare piani, analizzare una decisione o strutturare i prossimi passi su Life/AURA.',
  Finance: 'Agente Finance: posso leggere il budget, segnalare spese fuori pattern o proiettare il cash flow del mese.',
  Health: 'Agente Health: posso leggere sonno, HRV e attività per proporre aggiustamenti alla routine.',
  Fitness: "Agente Fitness: posso adattare il piano di allenamento in base a recupero e obiettivi.",
  Study: 'Agente Study: posso creare un piano di ripasso o tracciare i progressi verso Tedesco C1.',
  Mind: 'Agente Mind: posso leggere umore e journal e suggerire una pausa o un esercizio di respirazione.',
  Casa: 'Agente Casa: posso tracciare bollette, scadenze di affitto e lavori da organizzare.',
  Viaggi: 'Agente Viaggi: posso aiutarti con itinerario, checklist e prenotazioni di un viaggio.',
  Legal: 'Agente Legal: posso tenere traccia di contratti e scadenze (senza sostituire una consulenza legale reale).',
};

const topicKeywords: Record<string, string[]> = {
  Business: ['business', 'azienda', 'cliente', 'vendite', 'meeting', 'fatturato', 'investitori', 'marketing', 'startup', 'soci'],
  Finance: ['soldi', 'budget', 'spese', 'risparmio', 'banca', 'conto', 'investimento', 'bolletta', 'stipendio', 'tasse'],
  Health: ['salute', 'medico', 'dottore', 'sonno', 'dolore', 'visita', 'farmaco', 'analisi', 'sintomo'],
  Fitness: ['allenamento', 'palestra', 'corsa', 'muscoli', 'workout', 'sport', 'peso', 'dieta'],
  Study: ['studio', 'esame', 'tedesco', 'lezione', 'corso', 'libro', 'università', 'imparare'],
  Mind: ['umore', 'ansia', 'stress', 'meditazione', 'journal', 'emozioni', 'mente'],
  Casa: ['casa', 'affitto', 'trasloco', 'pulizie', 'mobili', 'elettricista', 'locale'],
  Viaggi: ['viaggio', 'volo', 'hotel', 'vacanza', 'aeroporto', 'valigia'],
  Legal: ['contratto', 'avvocato', 'causa', 'legale', 'diritto', 'firma'],
};

export function detectTopic(text: string): string | null {
  const low = text.toLowerCase();
  let best: string | null = null, bestScore = 0;
  for (const c of Object.keys(topicKeywords)) {
    const score = topicKeywords[c].reduce((s, k) => s + (low.includes(k) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

export function captureTask(text: string): string | null {
  const m = text.match(/\bdevo (fare|creare|scrivere|preparare|finire|completare|organizzare)\s+(.+)/i) || text.match(/\bbisogna (fare|creare|scrivere|preparare|organizzare)\s+(.+)/i);
  if (!m) return null;
  return (m[2] || '').replace(/[.!?]+$/, '').trim() || null;
}

export async function askAssistant(topic: string, history: ChatMsg[]): Promise<string> {
  if (!API_URL) return `LifePilot · ${topic}\n${catReplies[topic] ?? catReplies.General}\n\nL'assistente AI completo si attiva collegando l'app a un server (EXPO_PUBLIC_API_URL).`;
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, messages: history.slice(-20) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { reply?: string };
  return data.reply ?? 'Risposta vuota dal server.';
}
