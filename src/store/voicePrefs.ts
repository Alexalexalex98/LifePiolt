import { create } from 'zustand';

import { persisted } from './persist';

/**
 * Quale voce usa Theia per leggere ciò che c'è a schermo: quella del telefono (gratis, anche offline), Google Gemini (naturale, serve la fatturazione Google)
 * oppure un server vocale tuo e open source (Kokoro, Chatterbox, Qwen3-TTS…) con interfaccia compatibile con OpenAI: legge qualunque testo, senza frasi pre-registrate.
 */
export type VoiceEngine = 'device' | 'gemini' | 'custom';
type State = {
  engine: VoiceEngine;
  /** indirizzo del server vocale (senza /v1/audio/speech), nome della voce e del modello, chiave se serve */
  customUrl: string; customVoice: string;
  /** nome della voce da usare per ogni lingua dell'app (it, en, es, fr…): se manca vale `customVoice` */
  voices: Record<string, string>; customModel: string; customKey: string;
  /** legge da sola ogni passaggio di una ricetta */
  autoRead: boolean;
  set: (e: VoiceEngine) => void;
  setVoice: (lang: string, name: string) => void;
  patch: (p: Partial<Pick<State, 'customUrl' | 'customVoice' | 'customModel' | 'customKey' | 'autoRead'>>) => void;
};
export const useVoicePrefs = create<State>()(persisted<State>('voicePrefs2', (set) => ({
  engine: 'gemini', customUrl: '', customVoice: '', voices: {}, customModel: '', customKey: '', autoRead: false,
  set: (engine) => set({ engine }), patch: (p) => set(p), setVoice: (lang, name) => set((s) => ({ voices: { ...s.voices, [lang]: name } })),
}), (s) => ({ engine: s.engine, customUrl: s.customUrl, customVoice: s.customVoice, voices: s.voices, customModel: s.customModel, customKey: s.customKey, autoRead: s.autoRead }), { sensitive: true }));
