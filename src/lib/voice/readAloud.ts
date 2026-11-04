import { t } from '@/i18n/core';
import { VOICE_STYLES } from '@/lib/mindLibrary';
import { makeSpeechStream } from '@/lib/voice/speechEngine';
import type { SpeechStream } from '@/lib/voice/speak';
import { toast } from '@/store/toast';

let cur: SpeechStream | null = null;
export const stopReading = () => { cur?.stop(); cur = null; };
export const isReading = () => cur != null;

/** Legge ad alta voce un testo che c'è a schermo (un passaggio di ricetta, un messaggio di Theia) con la voce scelta. */
export function readAloud(text: string, style: string = VOICE_STYLES.calma): SpeechStream {
  stopReading();
  const clean = text.replace(/[•·]/g, ',').replace(/\s+/g, ' ').trim();
  const s = makeSpeechStream(() => undefined, { style, onUnavailable: () => toast(t('Nessuna voce disponibile: scegline una in Benessere mentale › Voce.')) });
  cur = s; s.push(clean); s.end();
  void s.done.then(() => { if (cur === s) cur = null; }).catch(() => { if (cur === s) cur = null; });
  return s;
}
