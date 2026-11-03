import { t as tl } from '@/i18n/core';
import type { Exercise } from '@/lib/mindExercises';
import { narrationPlan } from '@/lib/mindLibrary';
import { createSpeechStream, type SpeechStream } from '@/lib/voice/speak';

let current: SpeechStream | null = null;
export const stopNarration = () => { current?.stop(); current = null; };
export const isNarrating = () => current != null;

/**
 * Theia legge un esercizio a voce (Google Gemini, tramite il nostro server) con pause lunghe tra i passi.
 * `onPart(i, n)` dice a che passo è; `done` si chiude alla fine o quando si ferma.
 */
export function narrate(ex: Exercise, onPart?: (i: number, n: number) => void): { done: Promise<void>; stop: () => void } {
  stopNarration();
  const plan = narrationPlan(ex, tl('Mettiti comodo. Ti accompagno io.'));
  const stream = createSpeechStream(() => undefined);
  current = stream;
  let k = 0; const n = plan.filter((p) => p.kind === 'say').length;
  for (const p of plan) {
    if (p.kind === 'say') { stream.push(p.text); const i = k++; onPart?.(i, n); } else stream.pause(p.ms);
  }
  stream.end();
  const done = stream.done.then(() => { if (current === stream) current = null; });
  return { done, stop: () => { stream.stop(); if (current === stream) current = null; } };
}
