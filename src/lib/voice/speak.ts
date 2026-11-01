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
