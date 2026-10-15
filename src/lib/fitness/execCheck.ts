/** Controllo dell'esecuzione (modulo PURO): domanda per la lettura dei fotogrammi e istante dei fotogrammi da estrarre. */
import type { ExerciseX } from './exerciseDb.ts';
import { FAMILIES } from './poses.ts';

export const FRAME_COUNT = 6;
/** Istanti (in ms) dei fotogrammi da prendere dal video, distribuiti da poco dopo l'inizio a poco prima della fine. */
export function frameTimes(durationMs: number | undefined, n = FRAME_COUNT): number[] {
  const d = durationMs && durationMs > 500 ? durationMs : 6000;
  return Array.from({ length: n }, (_, i) => Math.round(d * (0.08 + (0.84 * i) / Math.max(1, n - 1))));
}

export function checkPrompt(ex: Pick<ExerciseX, 'name' | 'how' | 'fam'>): string {
  const fam = ex.fam ? FAMILIES[ex.fam] : undefined;
  return [
    `Sei un allenatore. Ti mostro ${FRAME_COUNT} fotogrammi in ordine di un video in cui una persona esegue l'esercizio «${ex.name}».`,
    `Come si fa: ${ex.how}`,
    fam ? `Punti chiave: ${fam.cues.join('; ')}.` : '',
    fam ? `Errori comuni: ${fam.mistakes.join('; ')}.` : '',
    'Rispondi in italiano, in modo breve e gentile, con queste tre parti:',
    'VERDETTO: una sola parola tra «Corretta», «Quasi corretta», «Da correggere», «Non si vede abbastanza».',
    'BENE: due o tre punti che la persona fa bene.',
    'DA CORREGGERE: i punti da migliorare, uno per riga, con un consiglio pratico.',
    'Descrivi solo ciò che vedi: se l\'inquadratura non basta, dillo. Non dare pareri medici.',
  ].filter(Boolean).join('\n');
}

export type CheckResult = { verdict: 'ok' | 'quasi' | 'correggere' | 'incerto'; good: string[]; fix: string[]; raw: string };
/** Legge la risposta (VERDETTO / BENE / DA CORREGGERE); se il formato non è quello, mostra il testo così com'è. */
export function parseCheck(text: string): CheckResult {
  const raw = (text ?? '').trim();
  const sec = (name: string) => { const m = raw.match(new RegExp(`${name}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:VERDETTO|BENE|DA CORREGGERE)\\b|$)`, 'i')); return m ? m[1].trim() : ''; };
  const list = (s: string) => s.split('\n').map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim()).filter(Boolean);
  const v = sec('VERDETTO').toLowerCase();
  const verdict: CheckResult['verdict'] = /non si vede/.test(v) ? 'incerto' : /quasi/.test(v) ? 'quasi' : /da correggere|scorrett/.test(v) ? 'correggere' : /corretta/.test(v) ? 'ok' : 'incerto';
  return { verdict, good: list(sec('BENE')), fix: list(sec('DA CORREGGERE')), raw };
}
