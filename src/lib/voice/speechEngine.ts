import { localeFor } from '@/lib/speech';
import { useApp } from '@/store/app';
import { useVoicePrefs } from '@/store/voicePrefs';
import { createLocalSpeech, localSpeechAvailable } from './localSpeech';
import { createSpeechStream, type SpeechStream } from './speak';

/**
 * Sceglie la voce: del telefono (gratis, predefinita) o Gemini (più naturale, con consumo). Se la voce del telefono non c'è
 * (modulo non installato) si usa Gemini. `cacheKey` serve solo a Gemini: i pezzi già letti si riascoltano senza rifare la richiesta.
 */
export function makeSpeechStream(onPos: (chunk: number, frac: number) => void, opts: { style?: string; recording?: boolean } = {}): SpeechStream {
  const engine = useVoicePrefs.getState().engine;
  if (engine === 'device' && localSpeechAvailable()) {
    const s = createLocalSpeech(localeFor(useApp.getState().language), onPos);
    if (s) return s;
  }
  return createSpeechStream(onPos, opts);
}
export const deviceVoiceAvailable = localSpeechAvailable;
