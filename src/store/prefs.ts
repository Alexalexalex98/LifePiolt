import { create } from 'zustand';

import { persisted } from './persist';

/** Stili di risposta tra cui l'utente può scegliere (Profilo > Cosa LifePilot sa di te). */
export const answerStyles = [
  { id: 'diretto', label: 'Risposte dirette e operative', hint: 'Vado al punto e propongo subito cosa fare.' },
  { id: 'discorsivo', label: 'Più discorsive', hint: 'Spiego il perché e il contesto, con più dettagli.' },
  { id: 'breve', label: 'Molto brevi', hint: 'Una o due frasi, solo l\'essenziale.' },
] as const;
export type AnswerStyle = (typeof answerStyles)[number]['id'];
export const DEFAULT_STYLE: AnswerStyle = 'diretto';
export const styleLabel = (id: string) => answerStyles.find((x) => x.id === id)?.label ?? answerStyles[0].label;

type PrefsState = {
  answerStyle: AnswerStyle;
  setAnswerStyle: (s: AnswerStyle) => void;
  reset: () => void;
};

export const usePrefs = create<PrefsState>()(
  persisted<PrefsState>('prefs', (set) => ({
    answerStyle: DEFAULT_STYLE,
    setAnswerStyle: (answerStyle) => set({ answerStyle }),
    reset: () => set({ answerStyle: DEFAULT_STYLE }),
  })),
);
