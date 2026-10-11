import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type * as SR from 'expo-speech-recognition';

import { formatRaw, mapNativeError, mapSpeechError, noTranscriber, type SpeechErrorCode, type SpeechEvent, type Transcriber, type VoiceDiag } from './speechCore';

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
      r.onerror = (e) => { lastError = formatRaw({ stage: 'ascolto', error: e.error }); if (!cancelled) onEvent({ type: 'error', code: mapSpeechError(e.error), raw: lastError }); };
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

/** Ultimo errore della voce (testo grezzo), per il pannello "Diagnostica voce". Solo in memoria. */
let lastError: string | null = null;
export const getLastSpeechError = () => lastError;
export const noteSpeechError = (raw: string) => { lastError = raw; };

/** Se dopo questi ms il motore non ha ancora emesso 'start', l'utente vede un messaggio invece di un'attesa infinita. */
const START_TIMEOUT_MS = 7000;

function nativeTransport(M: typeof SR): SpeechTransport {
  const subs: { remove: () => void }[] = [];
  const clear = () => { subs.splice(0).forEach((s) => { try { s.remove(); } catch { /* già rimosso */ } }); };
  let cancelled = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const stopWatchdog = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null; } };
  const mod = M.ExpoSpeechRecognitionModule;
  return {
    kind: 'native',
    start: async ({ locale, onEvent }) => {
      cancelled = false;
      // 1) permessi: SEMPRE richiesti a runtime prima di partire (Android: RECORD_AUDIO; iOS: microfono + riconoscimento)
      let perm;
      try { perm = await mod.requestPermissionsAsync(); }
      catch (e) { lastError = formatRaw({ stage: 'permessi', message: String(e) }); throw 'unavailable' satisfies SpeechErrorCode; }
      if (!perm.granted) {
        lastError = formatRaw({ stage: 'permessi', error: 'not-allowed', extra: `status=${perm.status}; canAskAgain=${perm.canAskAgain}${perm.restricted ? '; restricted=true' : ''}` });
        throw (perm.canAskAgain === false ? 'denied_forever' : 'denied') satisfies SpeechErrorCode;
      }
      // 2) servizio di riconoscimento presente? (su Android manca o è disattivato senza app/servizi vocali di Google)
      let available = false;
      try { available = mod.isRecognitionAvailable(); } catch (e) { lastError = formatRaw({ stage: 'disponibilità', message: String(e) }); }
      if (!available) {
        let svc = '';
        try { svc = mod.getSpeechRecognitionServices().join(',') || 'nessuno'; } catch { /* solo Android */ }
        lastError = formatRaw({ stage: 'disponibilità', error: 'service-not-allowed', extra: `isRecognitionAvailable=false${svc ? `; servizi=${svc}` : ''}` });
        throw (Platform.OS === 'android' ? 'service_missing' : 'unavailable') satisfies SpeechErrorCode;
      }
      clear(); stopWatchdog();
      const fail = (code: SpeechErrorCode, raw: string) => { lastError = raw; stopWatchdog(); if (!cancelled) onEvent({ type: 'error', code, raw }); };
      subs.push(
        mod.addListener('start', () => { stopWatchdog(); if (!cancelled) onEvent({ type: 'started' }); }),
        mod.addListener('result', (e) => {
          if (cancelled) return;
          const top = [...e.results].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]?.transcript ?? '';
          onEvent(e.isFinal ? { type: 'final', text: top } : { type: 'partial', text: top });
        }),
        mod.addListener('volumechange', (e) => { if (!cancelled) onEvent({ type: 'level', value: Math.max(0, e.value) / 10 }); }),
        // NESSUN errore silenzioso: ogni codice del modulo diventa un messaggio chiaro + il dettaglio grezzo
        mod.addListener('error', (e) => fail(mapNativeError(e.error, Platform.OS), formatRaw({ stage: 'ascolto', error: e.error, nativeCode: e.code, message: e.message }))),
        mod.addListener('end', () => { stopWatchdog(); if (!cancelled) onEvent({ type: 'end' }); clear(); }),
      );
      watchdog = setTimeout(() => {
        watchdog = null;
        if (cancelled) return;
        try { mod.abort(); } catch { /* già fermo */ }
        fail('start_timeout', formatRaw({ stage: 'avvio', extra: `nessun evento 'start' entro ${START_TIMEOUT_MS / 1000}s` }));
      }, START_TIMEOUT_MS);
      try {
        mod.start({
          lang: locale,
          interimResults: true,
          // un solo enunciato: finisce da sé quando smetti di parlare (su Android 12- 'continuous' non esiste)
          continuous: false,
          // la punteggiatura automatica è affidabile solo su iOS (su Android richiede il riconoscimento sul telefono)
          addsPunctuation: Platform.OS === 'ios',
          // rete consentita: il riconoscimento sul telefono richiede modelli lingua installati che spesso mancano
          requiresOnDeviceRecognition: false,
          // niente audio salvato: nessun `recordingOptions`
          volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
        });
      } catch (e) {
        fail('unknown', formatRaw({ stage: 'avvio', message: String(e) }));
      }
    },
    stop: () => { try { mod.stop(); } catch { /* già fermo */ } },
    cancel: () => { cancelled = true; stopWatchdog(); try { mod.abort(); } catch { /* già fermo */ } clear(); },
  };
}

/** Raccoglie lo stato della voce per il pannello "Diagnostica voce". Non lancia mai. */
export async function speechDiagnostics(locale: string): Promise<VoiceDiag> {
  const d: VoiceDiag = {
    platform: Platform.OS === 'android' ? `Android ${String(Platform.Version)}` : Platform.OS === 'ios' ? `iOS ${String(Platform.Version)}` : 'web',
    expoGo: inExpoGo, moduleLoaded: false, available: null, onDevice: null, micGranted: null, micCanAskAgain: null, speechGranted: null,
    services: [], defaultService: '', locale, localeSupported: null, lastError,
  };
  if (Platform.OS === 'web') {
    d.moduleLoaded = !!webCtor(); d.available = d.moduleLoaded;
    return d;
  }
  const M = loadNative();
  if (!M) return d;
  d.moduleLoaded = true;
  const mod = M.ExpoSpeechRecognitionModule;
  try { d.available = mod.isRecognitionAvailable(); } catch { /* resta null */ }
  try { d.onDevice = mod.supportsOnDeviceRecognition(); } catch { /* resta null */ }
  try {
    const mic = await mod.getMicrophonePermissionsAsync();
    d.micGranted = mic.granted; d.micCanAskAgain = mic.canAskAgain;
    if (Platform.OS === 'ios') d.speechGranted = (await mod.getSpeechRecognizerPermissionsAsync()).granted;
  } catch { /* resta null */ }
  if (Platform.OS === 'android') {
    try { d.services = mod.getSpeechRecognitionServices(); } catch { /* resta vuoto */ }
    try { d.defaultService = mod.getDefaultRecognitionService().packageName; } catch { /* resta vuoto */ }
    try {
      const l = await mod.getSupportedLocales({});
      const base = locale.slice(0, 2).toLowerCase();
      if (l.locales.length) d.localeSupported = l.locales.some((x) => x.toLowerCase().startsWith(base));
    } catch { /* Android 12- o servizio senza elenco */ }
  }
  return d;
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
