import { create } from 'zustand';

import { persisted } from './persist';

/** Quale voce usa Theia per leggere: quella del telefono (gratis, anche offline) o Google Gemini (più naturale, consuma il piano). */
export type VoiceEngine = 'device' | 'gemini';
type State = { engine: VoiceEngine; set: (e: VoiceEngine) => void };
export const useVoicePrefs = create<State>()(persisted<State>('voicePrefs', (set) => ({ engine: 'device', set: (engine) => set({ engine }) }), (s) => ({ engine: s.engine })));
