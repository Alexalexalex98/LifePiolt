import type { AudioMeta, CaptureMeta, Plan, PlannedScene, VideoSpec } from './types';

const GAP = 0.28; // pausa tra due frasi
const TAIL = 0.35; // respiro a fine scena
export const OUTRO = 2.6;
const wordsPer = 2.55; // stima senza audio: parole al secondo

const split = (t: string) => t.trim().split(/\s+/).filter(Boolean);
/** Tempi delle parole dentro la frase, in proporzione alla lunghezza (le pause di punteggiatura pesano di più). */
export function wordTimes(text: string, dur: number) {
  const ws = split(text);
  const weight = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1 + (/[,;:]$/.test(w) ? 1.2 : 0) + (/[.!?]$/.test(w) ? 2 : 0));
  const sum = weight.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return ws.map((w, i) => { const d = (weight[i] / sum) * dur; const r = { w, start: t, end: t + d }; t += d; return r; });
}

/** Mette insieme template, registrazione e audio: quando inizia e quanto dura ogni scena, a che velocità scorre la clip e dove cade ogni parola. */
export function planVideo(spec: VideoSpec, cap: CaptureMeta, audio: AudioMeta | null): Plan {
  let t = 0;
  const scenes: PlannedScene[] = spec.scenes.map((sc, si) => {
    const cue = cap.cues.find((c) => c.id === sc.cue);
    if (!cue) throw new Error(`Nel video «${spec.id}» la fase «${sc.cue}» non esiste nella registrazione «${cap.name}». Fasi disponibili: ${cap.cues.map((c) => c.id).join(', ')}`);
    const lines = Array.isArray(sc.say) ? sc.say : [sc.say];
    let off = 0;
    const sentences = lines.map((text, i) => {
      const a = audio?.sentences.find((s) => s.scene === si && s.i === i);
      const dur = a?.duration ?? split(text).length / wordsPer;
      const s = { text, start: off, dur, file: a?.file, words: wordTimes(text, dur) };
      off += dur + GAP;
      return s;
    });
    const narr = off - GAP + TAIL;
    const clipDur = Math.max(0.2, cue.end - cue.start);
    const rate = Math.min(1.6, Math.max(0.6, clipDur / narr));
    const playDur = clipDur / rate;
    const dur = Math.max(narr, playDur);
    const out = { cue, start: t, dur, rate, playDur, sentences, ...(sc.title ? { title: sc.title } : {}) };
    t += dur;
    return out;
  });
  return { scenes, introEnd: 0, outroStart: t, total: t + OUTRO };
}
