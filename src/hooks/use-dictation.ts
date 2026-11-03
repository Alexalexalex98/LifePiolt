import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { t } from '@/i18n/core';
import { createTransport, speechSupport, type SpeechTransport } from '@/lib/speech';
import { isActive, initialSpeech, liveText, localeFor, speechReducer, speechErrorText, type SpeechErrorCode } from '@/lib/speechCore';
import { useApp } from '@/store/app';

/** Detta a voce: `start()` apre il microfono, `live` è il testo mentre parli, `onText` riceve la trascrizione finita. Si ferma da solo in background. */
export function useDictation(onText: (text: string) => void) {
  const [speech, dispatch] = useReducer(speechReducer, initialSpeech);
  const transport = useRef<SpeechTransport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lang = useApp((s) => s.language);
  const stop = useCallback(() => { transport.current?.stop(); }, []);
  const cancel = useCallback(() => { transport.current?.cancel(); transport.current = null; dispatch({ type: 'cancel' }); }, []);
  useEffect(() => { const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') cancel(); }); return () => { sub.remove(); transport.current?.cancel(); }; }, [cancel]);
  useEffect(() => {
    if (speech.phase === 'error' && speech.error) { setError(speechErrorText(speech.error as SpeechErrorCode)); dispatch({ type: 'reset' }); transport.current = null; return; }
    if (speech.phase !== 'done' || !speech.result) return;
    const res = speech.result; dispatch({ type: 'reset' }); transport.current = null;
    if (res.trim()) onText(res.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.phase]);
  const start = useCallback(async () => {
    setError(null);
    const sup = speechSupport();
    if (!sup.ok) { setError(Platform.OS === 'web' ? t('Il microfono non è disponibile in questo browser.') : t('La dettatura non è disponibile su questo telefono: scrivi a mano.')); return; }
    const tr = createTransport(); if (!tr) { setError(t('La dettatura non è disponibile adesso.')); return; }
    transport.current = tr;
    const locale = localeFor(lang || 'it'); dispatch({ type: 'start', locale });
    try { await tr.start({ locale, onEvent: dispatch }); } catch (c) { transport.current = null; dispatch({ type: 'cancel' }); setError(typeof c === 'string' ? speechErrorText(c as SpeechErrorCode) : t('Non riesco ad ascoltare adesso.')); }
  }, [lang]);
  return { listening: isActive(speech), live: liveText(speech, lang || 'it'), error, start, stop, cancel, clearError: () => setError(null) };
}
