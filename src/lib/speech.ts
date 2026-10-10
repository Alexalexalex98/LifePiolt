import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type * as SR from 'expo-speech-recognition';

import { mapSpeechError, noTranscriber, type SpeechErrorCode, type SpeechEvent, type Transcriber } from './speechCore';

export * from './speechCore';

/**
 * Voce di Theia. Astrazione `SpeechTransport` con tre strade:
 *  (a) web: Web Speech API del browser (window.SpeechRecognition / webkitSpeechRecognition)
 *  (b) nativo: modulo `expo-speech-recognition` (SDK 57). Contiene codice nativo: NON è in Expo Go, serve una development build / build di produzione.
 *      Si carica solo quando serve e solo dove esiste (come src/lib/notify.ts), così Expo Go non va in crash.
 *  (c) predisposta: registrazione con expo-audio da mandare a un servizio di trascrizione. Il servizio NON esiste ancora: `transcriber.available` è false
 *      e l'app lo dice chiaramente. Nessun audio viene registrato in background né salvato.
 */

export type SpeechSupport =
  | { ok: true; kind: 'web' | 'native' }
  | { ok: false; kind: 'none'; reason: SpeechErrorCode };

export type StartOptions = { locale: string; onEvent: (e: SpeechEvent) => void };

export type SpeechTransport = {
  kind: 'web' | 'native';
  /** apre il microfono e inizia ad emettere eventi; rifiuta con un SpeechErrorCode se non può partire */
  start: (o: StartOptions) => Promise<void>;
  /** finisce di ascoltare: arriva il testo definitivo e poi 'end' */
  stop: () => void;
  /** annulla senza risultato */
  cancel: () => void;
};

/* ---------- servizio di trascrizione (fallback predisposto) ---------- */

let transcriber: Transcriber = noTranscriber;
/** Quando ci sarà il server di trascrizione si registra qui. */
export function setTranscriber(t: Transcriber) { transcriber = t; }
export const getTranscriber = () => transcriber;

/* ---------- web ---------- */

type WebRec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
};

function webCtor(): (new () => WebRec) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRec; webkitSpeechRecognition?: new () => WebRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function webTransport(Ctor: new () => WebRec): SpeechTransport {
  let rec: WebRec | null = null;
  let cancelled = false;
  return {
    kind: 'web',
    start: async ({ locale, onEvent }) => {
      cancelled = false;
      const r = new Ctor();
      rec = r;
      r.lang = locale; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      r.onstart = () => onEvent({ type: 'started' });
      r.onresult = (e) => {
        let partial = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0]?.transcript ?? '';
          if (res.isFinal) onEvent({ type: 'final', text });
          else partial += text;
        }
        if (partial) onEvent({ type: 'partial', text: partial });
      };
      r.onerror = (e) => { if (!cancelled) onEvent({ type: 'error', code: mapSpeechError(e.error) }); };
      r.onend = () => { if (!cancelled) onEvent({ type: 'end' }); rec = null; };
      try { r.start(); } catch { throw 'busy' satisfies SpeechErrorCode; }
    },
    stop: () => { try { rec?.stop(); } catch { /* già fermo */ } },
    cancel: () => { cancelled = true; try { rec?.abort(); } catch { /* già fermo */ } rec = null; },
  };
}

/* ---------- nativo ---------- */

const inExpoGo = Constants.executionEnvironment === 'storeClient';
let nativeMod: typeof SR | null | undefined;
function loadNative(): typeof SR | null {
  if (nativeMod !== undefined) return nativeMod;
  if (Platform.OS === 'web' || inExpoGo) return (nativeMod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeMod = require('expo-speech-recognition') as typeof SR;
  } catch { nativeMod = null; }
  return nativeMod;
}

function nativeTransport(M: typeof SR): SpeechTransport {
  const subs: { remove: () => void }[] = [];
  const clear = () => { subs.splice(0).forEach((s) => { try { s.remove(); } catch { /* già rimosso */ } }); };
  let cancelled = false;
  const mod = M.ExpoSpeechRecognitionModule;
  return {
    kind: 'native',
    start: async ({ locale, onEvent }) => {
      cancelled = false;
      let perm;
      try { perm = await mod.requestPermissionsAsync(); } catch { throw 'unavailable' satisfies SpeechErrorCode; }
      if (!perm.granted) throw 'denied' satisfies SpeechErrorCode;
      try { if (!mod.isRecognitionAvailable()) throw 'unavailable'; } catch (e) { throw (e === 'unavailable' ? e : 'unavailable') as SpeechErrorCode; }
      clear();
      subs.push(
        mod.addListener('start', () => { if (!cancelled) onEvent({ type: 'started' }); }),
        mod.addListener('result', (e) => {
          if (cancelled) return;
          const top = [...e.results].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]?.transcript ?? '';
          onEvent(e.isFinal ? { type: 'final', text: top } : { type: 'partial', text: top });
        }),
        mod.addListener('volumechange', (e) => { if (!cancelled) onEvent({ type: 'level', value: Math.max(0, e.value) / 10 }); }),
        mod.addListener('error', (e) => { if (!cancelled) onEvent({ type: 'error', code: mapSpeechError(e.error) }); }),
        mod.addListener('end', () => { if (!cancelled) onEvent({ type: 'end' }); clear(); }),
      );
      mod.start({
        lang: locale,
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        // niente audio salvato: nessun `recordingOptions`
        volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      });
    },
    stop: () => { try { mod.stop(); } catch { /* già fermo */ } },
    cancel: () => { cancelled = true; try { mod.abort(); } catch { /* già fermo */ } clear(); },
  };
}

/* ---------- selezione ---------- */

/** Dice se la voce è disponibile e, se no, perché (per mostrarlo nell'interfaccia). */
export function speechSupport(): SpeechSupport {
  if (Platform.OS === 'web') return webCtor() ? { ok: true, kind: 'web' } : { ok: false, kind: 'none', reason: 'unavailable' };
  if (inExpoGo) return { ok: false, kind: 'none', reason: transcriber.available ? 'unavailable' : 'needs_build' };
  return loadNative() ? { ok: true, kind: 'native' } : { ok: false, kind: 'none', reason: transcriber.available ? 'unavailable' : 'needs_build' };
}

let current: SpeechTransport | null = null;
/** Crea il trasporto adatto a questa piattaforma (null se la voce non c'è). */
export function createTransport(): SpeechTransport | null {
  const sup = speechSupport();
  if (!sup.ok) return null;
  if (sup.kind === 'web') { const c = webCtor(); current = c ? webTransport(c) : null; }
  else { const m = loadNative(); current = m ? nativeTransport(m) : null; }
  return current;
}
