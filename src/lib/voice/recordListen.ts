import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, type AudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';

import { aiAnalyze } from '@/lib/aiServer';
import { bytesToBase64 } from '@/lib/readUri';

export const REC_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
export type ListenEnd = { text: string } | { error: 'denied' | 'no_speech' | 'failed' };

/**
 * Ascolta con il microfono SENZA il riconoscimento vocale del telefono (per esempio in Expo Go): registra finché parli,
 * si ferma da sola dopo un attimo di silenzio, e fa trascrivere l'audio a Gemini. L'audio non viene salvato.
 */
export function listenByRecording(recorder: AudioRecorder, lang: string, onLevel: (v: number) => void): { done: Promise<ListenEnd>; finish: () => void; cancel: () => void } {
  let finishNow = false, cancelled = false;
  const done = (async (): Promise<ListenEnd> => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return { error: 'denied' };
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch { return { error: 'failed' }; }
    const t0 = Date.now();
    let noise = -50, spoke = false, quietSince = 0, samples = 0;
    while (!cancelled) {
      await new Promise((r) => setTimeout(r, 110));
      let db = -60;
      try { const st = recorder.getStatus(); db = typeof st.metering === 'number' ? st.metering : -60; } catch { cancelled = true; break; }
      onLevel(Math.max(0, Math.min(1, (db + 55) / 40)));
      const now = Date.now() - t0;
      if (now < 500) { noise = Math.max(noise, Math.min(db, -30)); samples++; continue; }
      const loud = db > Math.max(-38, noise + 12);
      if (loud) { spoke = true; quietSince = 0; } else if (spoke && !quietSince) quietSince = Date.now();
      if (finishNow) break;
      if (spoke && quietSince && Date.now() - quietSince > 1250) break;
      if (!spoke && now > 7000) break;
      if (now > 28000) break;
    }
    let uri: string | null = null;
    try { await recorder.stop(); uri = recorder.uri; } catch { /* già fermo */ }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    onLevel(0);
    if (cancelled) return { error: 'no_speech' };
    if (!spoke && !finishNow) return { error: 'no_speech' };
    if (!uri) return { error: 'failed' };
    try {
      const data = bytesToBase64(await new File(uri).bytes());
      const ask = `Trascrivi esattamente quello che dice la persona in questa registrazione (lingua dell'app: ${lang}). Rispondi SOLO con la trascrizione, senza commenti né virgolette. Se non si sente nessuno parlare, rispondi con una riga vuota.`;
      let reply = '';
      try { reply = (await aiAnalyze([{ data, mime: 'audio/mp4' }], ask)).reply; }
      catch { reply = (await aiAnalyze([{ data, mime: 'audio/aac' }], ask)).reply; }
      try { new File(uri).delete(); } catch { /* la cache si svuota da sola */ }
      const text = reply.replace(/^["“«\s]+|["”»\s]+$/g, '').trim();
      return text.length >= 2 ? { text } : { error: 'no_speech' };
    } catch { return { error: 'failed' }; }
  })();
  return { done, finish: () => { finishNow = true; }, cancel: () => { cancelled = true; } };
}
