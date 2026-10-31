import { create } from 'zustand';

import { persisted } from './persist';

type State = {
  /** indirizzo del Worker e parola d'ordine inseriti nell'app (hanno la precedenza su quelli della build) */
  url: string;
  token: string;
  /** ricerca sul web quando Theia non sa: solo la tua domanda, resa generica, mai i tuoi dati (di base attiva) */
  web?: boolean;
  /** risposte di Theia scritte da Google Gemini (piu' precise, senza ricerca sul web): la tua domanda e il contesto vanno a Google */
  gemini?: boolean;
  set: (p: Partial<Pick<State, 'url' | 'token' | 'web' | 'gemini'>>) => void;
};

/** Collegamento al server AI scelto dentro l'app: così una build funziona anche senza le variabili EXPO_PUBLIC_AI_*. Resta sul telefono. */
export const useAiServerCfg = create<State>()(
  persisted<State>('ai-server', (set) => ({
    url: '', token: '',
    set: (p) => set(p),
  }), undefined, { sensitive: true }),
);
