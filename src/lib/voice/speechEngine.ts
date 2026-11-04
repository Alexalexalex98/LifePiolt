import { localeFor } from '@/lib/speech';
import { useVoicePrefs } from '@/store/voicePrefs';
import { createLocalSpeech, localSpeechAvailable } from './localSpeech';
import { toast } from '@/store/toast';
import { createSpeechStream, speechLang, type SpeechStream } from './speak';

/** Gemini non risponde (es. quota Google esaurita): per un po' si usa subito la voce del telefono. */
let geminiDownUntil = 0;
export const geminiIsDown = (): boolean => Date.now() < geminiDownUntil;

/**
 * Sceglie la voce: del telefono (gratis, predefinita) o Gemini (più naturale, con consumo). Se la voce del telefono non c'è
 * (modulo non installato) si usa Gemini. `cacheKey` serve solo a Gemini: i pezzi già letti si riascoltano senza rifare la richiesta.
 */
export function makeSpeechStream(onPos: (chunk: number, frac: number) => void, opts: { style?: string; recording?: boolean; /** nessuna voce disponibile (né Gemini né telefono) */ onUnavailable?: (why: string) => void } = {}): SpeechStream {
  const engine = useVoicePrefs.getState().engine;
  const local = () => createLocalSpeech(localeFor(speechLang()), onPos);
  if (engine === 'device' && localSpeechAvailable()) { const s = local(); if (s) return s; }
  /* Gemini con ripiego: se il primo pezzo fallisce, i pezzi rimasti passano alla voce del telefono */
  type Item = { text?: string; ms?: number };
  const items: Item[] = []; let ended = false;
  let active: SpeechStream | null = null; let swapped = false; let stopped = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((r) => { resolveDone = r; });
  const primary = createSpeechStream(onPos, { ...opts, onFail: (i, why) => {
    if (swapped || stopped) return;
    if (!localSpeechAvailable()) { swapped = true; geminiDownUntil = Date.now() + 30 * 60000; primary.stop(); opts.onUnavailable?.(why); resolveDone(); return; }
    swapped = true; geminiDownUntil = Date.now() + 30 * 60000;
    const l = local(); if (!l) return;
    primary.stop(); active = l;
    toast(/quota|exceed|limit/i.test(why) ? 'La voce di Google ha raggiunto il limite: uso la voce del telefono.' : 'La voce di Theia non risponde: uso la voce del telefono.');
    items.slice(i).forEach((it) => { if (it.text !== undefined) l.push(it.text); else l.pause(it.ms ?? 0); });
    if (ended) l.end();
    void l.done.then(resolveDone);
  } });
  active = primary;
  void primary.done.then(() => { if (!swapped) resolveDone(); });
  return {
    push: (text) => { items.push({ text }); active?.push(text); },
    pause: (ms) => { items.push({ ms }); active?.pause(ms); },
    end: () => { ended = true; active?.end(); },
    stop: () => { stopped = true; primary.stop(); if (active !== primary) active?.stop(); resolveDone(); },
    done,
    started: () => !!active?.started(),
  };
}
export const deviceVoiceAvailable = localSpeechAvailable;
