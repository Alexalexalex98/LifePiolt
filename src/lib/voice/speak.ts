import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { aiTts } from '@/lib/aiServer';
import { bytesToBase64 } from '@/lib/readUri';
import { base64ToBytes, pcmRate, pcmToWav } from './voiceText';

export type Speaking = { /** finisce quando l'audio è finito o fermato */ done: Promise<void>; stop: () => void };

/** Theia legge il testo ad alta voce con la voce di Google Gemini. Rifiuta se la voce non è disponibile (allora resta il testo). */
export async function speak(text: string): Promise<Speaking> {
  const r = await aiTts(text);
  const wav = pcmToWav(base64ToBytes(r.audio), pcmRate(r.mime));
  let file: File | null = null;
  let uri: string;
  if (Platform.OS === 'web') uri = `data:audio/wav;base64,${bytesToBase64(wav)}`;
  else {
    file = new File(Paths.cache, `theia-voice-${Date.now().toString(36)}.wav`);
    file.create({ overwrite: true }); file.write(wav); uri = file.uri;
  }
  try { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }); } catch { /* resta l'impostazione attuale */ }
  const player = createAudioPlayer(uri);
  let finish!: () => void;
  const done = new Promise<void>((res) => { finish = res; });
  let over = false;
  const end = () => {
    if (over) return; over = true;
    try { sub.remove(); } catch { /* già tolto */ }
    try { player.pause(); player.remove(); } catch { /* già fermo */ }
    try { file?.delete(); } catch { /* la cache si svuota da sola */ }
    finish();
  };
  const sub = player.addListener('playbackStatusUpdate', (st) => { if (st.didJustFinish) end(); });
  player.play();
  setTimeout(end, 120000);
  return { done, stop: end };
}

export type SpeechStream = {
  /** aggiunge un pezzo di testo da leggere (parte subito la richiesta della voce; si legge in ordine) */
  push: (text: string) => void;
  /** una pausa di silenzio (ms) tra un pezzo e l'altro: serve alle meditazioni guidate */
  pause: (ms: number) => void;
  /** non arriveranno altri pezzi: `done` si chiude quando ha finito di leggere */
  end: () => void;
  stop: () => void;
  done: Promise<void>;
  /** è partito almeno un pezzo audio */
  started: () => boolean;
};

type Prepared = { uri: string; file: File | null };
async function prepare(text: string): Promise<Prepared> {
  const r = await aiTts(text);
  const wav = pcmToWav(base64ToBytes(r.audio), pcmRate(r.mime));
  if (Platform.OS === 'web') return { uri: `data:audio/wav;base64,${bytesToBase64(wav)}`, file: null };
  const file = new File(Paths.cache, `theia-voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.wav`);
  file.create({ overwrite: true }); file.write(wav);
  return { uri: file.uri, file };
}

/**
 * La voce di Theia a pezzi: ogni pezzo viene preparato appena arriva (anche mentre il testo si sta ancora scrivendo) e letto in ordine,
 * così Theia inizia a parlare dopo le prime frasi. `onPos(i, frazione)` dice a che punto è: serve a far scorrere il testo con la voce.
 */
export function createSpeechStream(onPos: (chunk: number, frac: number) => void): SpeechStream {
  const jobs: Promise<Prepared | { pause: number } | null>[] = [];
  let ended = false, stopped = false, began = false, wake: (() => void) | null = null;
  let cur: { stop: () => void } | null = null;
  const poke = () => { const w = wake; wake = null; w?.(); };
  const done = (async () => {
   try {
    try { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }); } catch { /* resta l'impostazione attuale */ }
    for (let i = 0; !stopped; i++) {
      while (i >= jobs.length && !ended && !stopped) await new Promise<void>((r) => { wake = r; });
      if (stopped || i >= jobs.length) break;
      const p = await jobs[i];
      if (p && 'pause' in p) { await new Promise<void>((r) => { const h = setTimeout(r, p.pause); cur = { stop: () => { clearTimeout(h); r(); } }; }); cur = null; continue; }
      if (!p || stopped) { (p as Prepared | null)?.file?.delete(); continue; }
      began = true;
      await new Promise<void>((res) => {
        let player: ReturnType<typeof createAudioPlayer>;
        try { player = createAudioPlayer(p.uri); } catch { try { p.file?.delete(); } catch { /* cache */ } res(); return; }
        let over = false;
        const fin = () => {
          if (over) return; over = true; clearTimeout(guard);
          try { sub.remove(); } catch { /* già tolto */ }
          try { player.pause(); player.remove(); } catch { /* già fermo */ }
          try { p.file?.delete(); } catch { /* la cache si svuota da sola */ }
          cur = null; res();
        };
        const sub = player.addListener('playbackStatusUpdate', (st) => {
          try {
            if (st.didJustFinish) { onPos(i, 1); fin(); return; }
            if (st.duration > 0) onPos(i, Math.min(1, st.currentTime / st.duration));
          } catch { /* aggiornamento perso */ }
        });
        const guard = setTimeout(fin, 90000);
        cur = { stop: fin };
        onPos(i, 0);
        try { player.play(); } catch { fin(); }
      });
    }
   } catch { /* la voce si ferma: il testo resta scritto */ }
  })();
  return {
    push: (text) => { if (stopped || ended) return; jobs.push(prepare(text).catch(() => null)); poke(); },
    pause: (ms) => { if (stopped || ended) return; jobs.push(Promise.resolve({ pause: ms })); poke(); },
    end: () => { ended = true; poke(); },
    stop: () => { stopped = true; cur?.stop(); poke(); jobs.forEach((j) => void j.then((p) => { try { (p as Prepared | null)?.file?.delete?.(); } catch { /* cache */ } })); },
    done,
    started: () => began,
  };
}
