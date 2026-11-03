import type { SpeechStream } from './speak';

/** Il pezzo di expo-speech che serve (il modulo si carica solo se c'è: senza, si usa Gemini). */
type SpeechMod = {
  speak(text: string, o?: Record<string, unknown>): void;
  stop(): void;
  getAvailableVoicesAsync(): Promise<{ identifier: string; language?: string; quality?: string }[]>;
};
let mod: SpeechMod | null | undefined;
function load(): SpeechMod | null {
  if (mod !== undefined) return mod;
  try { mod = require('expo-speech') as SpeechMod; } catch { mod = null; }
  return mod;
}
export const localSpeechAvailable = (): boolean => load() != null;

let voiceId: string | undefined | null;
async function bestVoice(M: SpeechMod, lang: string): Promise<string | undefined> {
  if (voiceId !== undefined && voiceId !== null) return voiceId;
  try {
    const all = await M.getAvailableVoicesAsync();
    const l = lang.slice(0, 2).toLowerCase();
    const mine = all.filter((v) => v.language?.toLowerCase().startsWith(l));
    const rank = (v: { quality?: string }) => (v.quality === 'Enhanced' ? 2 : 1);
    mine.sort((a, b) => rank(b) - rank(a));
    voiceId = mine[0]?.identifier ?? null;
  } catch { voiceId = null; }
  return voiceId ?? undefined;
}

/**
 * La voce del telefono (expo-speech): gratis, anche offline, nessun consumo di Gemini. Stessa interfaccia della voce Gemini.
 * `onPos(i, frac)` segue il parlato (sulle piattaforme che dicono la parola corrente) o fa 0 → 1 per ogni pezzo.
 */
export function createLocalSpeech(lang: string, onPos: (chunk: number, frac: number) => void, rate = 0.9): SpeechStream | null {
  const M = load();
  if (!M) return null;
  type Job = { text?: string; pause?: number };
  const jobs: Job[] = [];
  let ended = false, stopped = false, began = false, wake: (() => void) | null = null;
  const poke = () => { const w = wake; wake = null; w?.(); };
  let curTimer: ReturnType<typeof setTimeout> | null = null; let curRes: (() => void) | null = null;
  const done = (async () => {
    try {
      try { const A = require('expo-audio') as typeof import('expo-audio'); await A.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }); } catch { /* resta l'impostazione attuale */ }
      const voice = await bestVoice(M, lang);
      let chunk = 0;
      for (let i = 0; !stopped; i++) {
        while (i >= jobs.length && !ended && !stopped) await new Promise<void>((r) => { wake = r; });
        if (stopped || i >= jobs.length) break;
        const j = jobs[i]!;
        if (j.pause != null) { await new Promise<void>((r) => { curRes = r; curTimer = setTimeout(r, j.pause); }); curTimer = null; curRes = null; continue; }
        const text = j.text ?? ''; const c = chunk++;
        began = true; onPos(c, 0);
        await new Promise<void>((res) => {
          curRes = res;
          M.speak(text, {
            language: lang, rate, ...(voice ? { voice } : {}),
            onBoundary: (e: { charIndex?: number }) => { if (typeof e?.charIndex === 'number' && text.length) onPos(c, Math.min(1, e.charIndex / text.length)); },
            onDone: () => { onPos(c, 1); res(); }, onStopped: () => res(), onError: () => res(),
          });
        });
        curRes = null;
      }
    } catch { /* la voce si ferma: resta il testo */ }
  })();
  return {
    push: (text) => { if (stopped || ended) return; jobs.push({ text }); poke(); },
    pause: (ms) => { if (stopped || ended) return; jobs.push({ pause: ms }); poke(); },
    end: () => { ended = true; poke(); },
    stop: () => { stopped = true; try { M.stop(); } catch { /* già fermo */ } if (curTimer) clearTimeout(curTimer); curRes?.(); poke(); },
    done, started: () => began,
  };
}
