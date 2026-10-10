import { normalize, indexOfWord } from './match.ts';
import { tx } from './tx.ts';

/**
 * Principio guida: Theia non "pensa", DELEGA solo cio' che serve davvero a un altro modello.
 * Tutto cio' che si fa con algoritmi locali (impegni, task, note, obiettivi, umore, spese, pianificazione, priorita', analisi,
 * correlazioni, insight, interessi, briefing, ricerca nei propri dati, report) resta sul telefono, offline, senza AI terze.
 * L'assistente locale capisce italiano e inglese: le parole qui sotto sono in quelle due lingue.
 */
export type LocalCapability = { id: string; label: string; example: string; words: string[] };

export const LOCAL_CAPABILITIES: LocalCapability[] = [
  { id: 'plan', label: 'Impegni e agenda', example: 'aggiungi riunione al piano domani alle 15', words: ['impegno', 'impegni', 'appuntamento', 'riunione', 'calendario', 'agenda', 'al piano', 'meeting', 'my plan', 'appointment', 'calendar', 'schedule'] },
  { id: 'tasks', label: 'Task e promemoria', example: 'ricordami di chiamare Marco', words: ['task', 'attivita', 'da fare', 'promemoria', 'ricordami', 'sveglia', 'to-do', 'todo', 'remind me', 'reminder'] },
  { id: 'notes', label: 'Note', example: 'scrivi una nota: idee per il weekend', words: ['nota', 'note', 'appunto', 'appunti', 'my notes'] },
  { id: 'goals', label: 'Obiettivi', example: 'come vanno i miei obiettivi?', words: ['obiettivo', 'obiettivi', 'goal', 'goals'] },
  { id: 'mood', label: 'Umore e benessere', example: 'segna umore 4', words: ['umore', 'mood', 'come mi sento'] },
  { id: 'money', label: 'Spese e budget', example: 'ho speso 12 euro al supermercato', words: ['ho speso', 'spesa', 'spese', 'budget', 'i miei soldi', 'expense', 'spent'] },
  { id: 'planning', label: 'Pianificazione e priorita', example: 'pianificami il mese', words: ['pianificami', 'pianifica', 'priorita', 'cosa devo fare', 'plan my', 'what should i do', 'prioritize', 'urgente', 'urgent'] },
  { id: 'insights', label: 'Analisi, correlazioni e insight', example: 'che correlazioni ci sono tra sonno e umore?', words: ['correlazion', 'insight', 'analisi dei miei', 'analizza i miei', 'andamento', 'trend', 'my data', 'i miei dati'] },
  { id: 'interests', label: 'Interessi e suggerimenti', example: 'cosa posso fare vicino a me?', words: ['interessi', 'interests', 'vicino a me', 'near me'] },
  { id: 'briefing', label: 'Briefing della giornata', example: 'com\'e la mia giornata?', words: ['briefing', 'la mia giornata', 'my day', 'riepilogo di oggi', 'today summary'] },
  { id: 'search', label: 'Ricerca nei propri dati', example: 'cerca nelle mie note "dentista"', words: ['cerca nelle mie', 'cerca nei miei', 'trova nelle mie', 'search my', 'find in my'] },
  { id: 'report', label: 'Report', example: 'fammi il report della settimana', words: ['report della', 'report del', 'weekly report', 'resoconto'] },
  { id: 'undo', label: 'Annulla, sposta, segna', example: 'annulla, sposta alle 18, segna X come urgente', words: ['annulla', 'sposta', 'segna ', 'undo', 'move it', 'mark '] },
];

export type LocalVerdict = { local: boolean; reason: string; capability?: string };

/** Il compito e' gestibile in locale? Richiede una parola dell'app: da sola non basta a escludere una delega esplicita (immagini, canzoni...). */
export function localVerdict(text: string): LocalVerdict {
  const n = normalize(text);
  for (const c of LOCAL_CAPABILITIES) {
    for (const w of c.words) {
      if (indexOfWord(n, normalize(w)) >= 0) return { local: true, capability: c.id, reason: tx('Lo faccio io sul telefono ({0}): nessuna AI esterna.', tx(c.label)) };
    }
  }
  return { local: false, reason: '' };
}
