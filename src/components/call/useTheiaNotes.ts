import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { buildNotes, type TLine } from '@/lib/callNotes';
import { createTransport, initialSpeech, isActive, localeFor, speechReducer, speechSupport, type SpeechTransport } from '@/lib/speech';

/**
 * Trascrizione continua della PROPRIA voce sul proprio telefono, per gli appunti di Theia. Ogni frase finita diventa una riga;
 * poi riparte l'ascolto finché è attivo. Niente audio salvato: si tiene solo il testo. Si ferma in background.
 */
export function useCallTranscription(o: { enabled: boolean; speaker: string; lang: string; startedAt: number; onLine: (l: TLine) => void }) {
  const { enabled, speaker, lang, startedAt, onLine } = o;
  const [speech, dispatch] = useReducer(speechReducer, initialSpeech);
  const transport = useRef<SpeechTransport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const live = useRef(enabled);
  live.current = enabled;
  const sup = speechSupport();

  const stop = useCallback(() => { transport.current?.cancel(); transport.current = null; dispatch({ type: 'cancel' }); }, []);
  const start = useCallback(async () => {
    if (!live.current || transport.current) return;
    if (!sup.ok) { setProblem('La trascrizione non è disponibile su questo dispositivo (serve il riconoscimento vocale del telefono).'); return; }
    const tr = createTransport();
    if (!tr) { setProblem('Il riconoscimento vocale non è disponibile.'); return; }
    transport.current = tr;
    const locale = localeFor(lang);
    dispatch({ type: 'start', locale });
    try { await tr.start({ locale, onEvent: dispatch }); setProblem(null); }
    catch { transport.current = null; dispatch({ type: 'cancel' }); setProblem('Non riesco ad ascoltare: controlla il permesso del microfono.'); }
  }, [lang, sup.ok]);

  // fine frase: salvo la riga e riparto
  useEffect(() => {
    if (speech.phase === 'done' && speech.result) {
      const text = speech.result.trim();
      transport.current = null;
      dispatch({ type: 'reset' });
      if (text) onLine({ at: Date.now() - startedAt, speaker, text });
      if (live.current) setTimeout(() => void start(), 250);
    } else if (speech.phase === 'error') {
      transport.current = null;
      dispatch({ type: 'reset' });
      if (live.current) setTimeout(() => void start(), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.phase]);

  useEffect(() => { if (enabled) void start(); else stop(); return stop; }, [enabled, start, stop]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') stop(); else if (live.current) void start(); });
    return () => sub.remove();
  }, [start, stop]);

  return { listening: isActive(speech), partial: speech.partial, problem };
}

/** Le cose importanti rilevate finora (decisioni, da fare, domande, numeri). */
export const liveHighlights = (lines: TLine[]) => buildNotes(lines);
