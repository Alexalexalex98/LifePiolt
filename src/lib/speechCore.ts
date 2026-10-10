/**
 * Logica PURA della voce di Theia (nessun import dall'app, nessun modulo nativo): si prova con node:test.
 * - mappa lingua dell'app -> codice BCP-47 del riconoscimento vocale
 * - macchina a stati dell'ascolto (reducer)
 * - pulizia della trascrizione
 * - errori del riconoscimento -> codici nostri + messaggio chiaro (testo sorgente in italiano: l'interfaccia lo traduce)
 */

export type SpeechLang = 'it' | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'hi' | 'ar' | 'ru' | 'ja' | 'id';

/** Codici BCP-47 usati dal riconoscimento vocale (iOS SFSpeechRecognizer, Android SpeechRecognizer, Web Speech API). */
export const SPEECH_LOCALES: Record<SpeechLang, string> = {
  it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR',
  zh: 'zh-CN', hi: 'hi-IN', ar: 'ar-SA', ru: 'ru-RU', ja: 'ja-JP', id: 'id-ID',
};

export const SPEECH_LANGS = Object.keys(SPEECH_LOCALES) as SpeechLang[];

export const isSpeechLang = (c: unknown): c is SpeechLang => typeof c === 'string' && c in SPEECH_LOCALES;

/** Lingua dell'app (o scelta al volo) -> locale del riconoscimento. Lingue sconosciute: italiano (la lingua sorgente dell'app). */
export function localeFor(lang: string): string {
  return isSpeechLang(lang) ? SPEECH_LOCALES[lang] : SPEECH_LOCALES.it;
}

/** Lingua base ("pt-BR" -> "pt") se è una delle 12; altrimenti null. */
export function langOfLocale(locale: string): SpeechLang | null {
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return isSpeechLang(base) ? base : null;
}

/** True se la lingua si scrive da destra a sinistra. */
export const isRtlLang = (lang: string) => lang === 'ar';

/* ---------- errori ---------- */

export type SpeechErrorCode =
  | 'denied'          // permesso microfono / riconoscimento negato
  | 'unsupported_lang' // il telefono non ha questa lingua per il riconoscimento
  | 'offline'         // serve la rete e non c'è
  | 'no_speech'       // non ho sentito nulla
  | 'no_mic'          // nessun microfono disponibile
  | 'busy'            // un altro ascolto è già in corso
  | 'unavailable'     // il riconoscimento non c'è su questo dispositivo/browser
  | 'needs_build'     // richiede la build dell'app (non Expo Go)
  | 'no_service'      // servizio di trascrizione non ancora collegato
  | 'unknown';

/** Converte i codici di errore del modulo nativo e della Web Speech API nei nostri. */
export function mapSpeechError(raw: string | undefined | null): SpeechErrorCode {
  switch ((raw ?? '').toLowerCase()) {
    case 'not-allowed': case 'service-not-allowed': case 'permission': case 'denied': return 'denied';
    case 'language-not-supported': case 'bad-grammar': return 'unsupported_lang';
    case 'network': return 'offline';
    case 'no-speech': case 'speech-timeout': case 'nomatch': return 'no_speech';
    case 'audio-capture': return 'no_mic';
    case 'busy': return 'busy';
    case 'aborted': case 'interrupted': return 'unknown';
    default: return 'unknown';
  }
}

/** Messaggio per l'utente (testo sorgente italiano; si traduce con t() o dentro <Text>). */
export function speechErrorText(code: SpeechErrorCode): string {
  switch (code) {
    case 'denied': return 'Permesso negato: abilita il microfono e il riconoscimento vocale per LifePilot dalle impostazioni del telefono.';
    case 'unsupported_lang': return 'Questa lingua non è supportata dal riconoscimento vocale di questo telefono. Scegli un\'altra lingua oppure scrivi il comando.';
    case 'offline': return 'Nessuna rete: il riconoscimento vocale di questa lingua ha bisogno di internet. Scrivi il comando oppure riprova online.';
    case 'no_speech': return 'Non ho sentito nulla. Riprova avvicinandoti al microfono.';
    case 'no_mic': return 'Non trovo un microfono utilizzabile.';
    case 'busy': return 'Il microfono è già in uso. Riprova tra un attimo.';
    case 'unavailable': return 'Il riconoscimento vocale non è disponibile su questo dispositivo o browser. Puoi scrivere il comando.';
    case 'needs_build': return 'La voce su questo telefono richiede la build dell\'app: in Expo Go non è disponibile. Puoi scrivere il comando.';
    case 'no_service': return 'Il servizio di trascrizione non è ancora collegato: per ora la voce funziona solo dove il telefono la riconosce da solo. Puoi scrivere il comando.';
    default: return 'Non sono riuscita ad ascoltarti. Riprova oppure scrivi il comando.';
  }
}

/** Errori dopo i quali ha senso riprovare subito con lo stesso pulsante. */
export const isRetryable = (c: SpeechErrorCode) => c === 'no_speech' || c === 'busy' || c === 'unknown' || c === 'offline';

/* ---------- macchina a stati ---------- */

export type SpeechPhase = 'idle' | 'starting' | 'listening' | 'processing' | 'done' | 'error';

export type SpeechState = {
  phase: SpeechPhase;
  /** locale BCP-47 in uso */
  locale: string;
  /** testo parziale (cambia mentre parli) */
  partial: string;
  /** testo definitivo (segmenti già confermati) */
  final: string;
  /** livello del microfono 0..1 per l'onda */
  level: number;
  error?: SpeechErrorCode;
  /** trascrizione pronta (phase = 'done') */
  result?: string;
};

export type SpeechEvent =
  | { type: 'start'; locale: string }
  | { type: 'started' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'level'; value: number }
  | { type: 'end' }
  | { type: 'error'; code: SpeechErrorCode }
  | { type: 'cancel' }
  | { type: 'reset' };

export const initialSpeech: SpeechState = { phase: 'idle', locale: SPEECH_LOCALES.it, partial: '', final: '', level: 0 };

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Testo mostrato a schermo mentre si parla: i segmenti confermati + quello in corso. */
export const liveText = (s: Pick<SpeechState, 'final' | 'partial'>, lang = 'it') => joinSegments([s.final, s.partial], lang);

export function speechReducer(s: SpeechState, e: SpeechEvent): SpeechState {
  switch (e.type) {
    case 'start':
      // un nuovo ascolto parte solo da fermo, da errore o dopo un risultato
      if (s.phase === 'starting' || s.phase === 'listening' || s.phase === 'processing') return s;
      return { phase: 'starting', locale: e.locale, partial: '', final: '', level: 0 };
    case 'started':
      return s.phase === 'starting' ? { ...s, phase: 'listening' } : s;
    case 'partial':
      return s.phase === 'listening' || s.phase === 'starting' ? { ...s, phase: 'listening', partial: e.text } : s;
    case 'final': {
      if (s.phase !== 'listening' && s.phase !== 'starting' && s.phase !== 'processing') return s;
      const final = e.text.trim() ? joinSegments([s.final, e.text], s.locale.slice(0, 2)) : s.final;
      return { ...s, phase: s.phase === 'processing' ? 'processing' : 'listening', final, partial: '' };
    }
    case 'level':
      return s.phase === 'listening' ? { ...s, level: clamp01(e.value) } : s;
    case 'end': {
      if (s.phase === 'idle' || s.phase === 'done' || s.phase === 'error') return s;
      const text = cleanTranscript(liveText(s, s.locale.slice(0, 2)), s.locale.slice(0, 2));
      return text ? { ...s, phase: 'done', result: text, partial: '', level: 0 } : { ...s, phase: 'error', error: 'no_speech', partial: '', level: 0 };
    }
    case 'error':
      if (s.phase === 'idle') return s;
      // se un errore "soft" arriva dopo aver già sentito qualcosa, il testo si tiene
      if ((e.code === 'no_speech' || e.code === 'unknown') && (s.final || s.partial)) return speechReducer(s, { type: 'end' });
      return { ...s, phase: 'error', error: e.code, partial: '', level: 0 };
    case 'cancel':
      return { ...initialSpeech, locale: s.locale };
    case 'reset':
      return { ...initialSpeech, locale: s.locale };
  }
}

/** L'ascolto è in corso (microfono aperto o in apertura). */
export const isActive = (s: SpeechState) => s.phase === 'starting' || s.phase === 'listening' || s.phase === 'processing';

/* ---------- pulizia del testo ---------- */

const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;
const NO_SPACE_LANGS = new Set(['zh', 'ja']);

/** Unisce segmenti: negli alfabeti con spazi li separa, in cinese/giapponese li attacca. */
export function joinSegments(parts: string[], lang = 'it'): string {
  const ps = parts.map((p) => p.trim()).filter(Boolean);
  if (!ps.length) return '';
  if (NO_SPACE_LANGS.has(lang)) return ps.join('');
  return ps.join(' ');
}

/**
 * Pulisce la trascrizione: spazi doppi, spazi tra caratteri cinesi/giapponesi (alcuni motori ne inseriscono),
 * spazi prima della punteggiatura, prima lettera maiuscola negli alfabeti che la usano. Non cambia le parole.
 */
export function cleanTranscript(raw: string, lang = 'it'): string {
  let s = (raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (NO_SPACE_LANGS.has(lang) || CJK.test(s)) {
    s = s.replace(/(?<=[぀-ヿ㐀-鿿豈-﫿，。！？、：；])\s+(?=[぀-ヿ㐀-鿿豈-﫿，。！？、：；0-9])/g, '');
    s = s.replace(/(?<=[0-9])\s+(?=[㐀-鿿぀-ヿ])/g, '');
  }
  s = s.replace(/\s+([,.;:!?،؟。，！？])/g, '$1');
  if (!['zh', 'ja', 'hi', 'ar'].includes(lang)) s = s.charAt(0).toLocaleUpperCase(localeFor(lang)) + s.slice(1);
  return s;
}

/** Unisce i risultati alternativi del motore nativo: tiene il più sicuro. */
export function bestAlternative(results: { transcript: string; confidence?: number }[]): string {
  if (!results.length) return '';
  const sorted = [...results].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return sorted[0].transcript ?? '';
}

/* ---------- configurazione ---------- */

/** Dopo quanti secondi di silenzio l'invio automatico considera finito il discorso (solo informativo: lo decide il motore). */
export type VoiceMode = 'confirm' | 'auto';

/** Decide se la trascrizione va inviata subito o mostrata per conferma. */
export function shouldAutoSend(mode: VoiceMode, text: string, minChars = 2): boolean {
  return mode === 'auto' && text.trim().length >= minChars;
}

/* ---------- servizio di trascrizione (predisposto, non collegato) ---------- */

/**
 * Interfaccia del servizio di trascrizione a cui mandare un breve audio registrato quando il telefono non sa riconoscere la voce da solo.
 * Oggi NON esiste nessun servizio: `available` è false e l'app lo dice, non finge.
 */
export type Transcriber = {
  available: boolean;
  /** invia l'audio (file locale) e restituisce il testo; deve cancellare ogni copia dell'audio appena finito */
  transcribe: (audioUri: string, locale: string) => Promise<string>;
};

export const noTranscriber: Transcriber = {
  available: false,
  transcribe: async () => { throw new Error('no_service'); },
};
