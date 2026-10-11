import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PermissionError, persistFile } from '@/lib/chatMedia';

export const VOICE_NOTE_MAX_MS = 30000;

export type VoiceNote = { uri: string; durationMs: number };

/**
 * Registrazione audio breve (max 30 s) SOLO in locale, quando il telefono non sa riconoscere la voce da solo.
 * Non viene inviata a nessuno: senza un servizio di trascrizione resta una nota audio salvata sul telefono.
 */
export function useVoiceNote() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [ms, setMs] = useState(0);
  const [saved, setSaved] = useState<VoiceNote | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => clearTimer, []);

  const stop = useCallback(async (): Promise<VoiceNote | null> => {
    clearTimer();
    const dur = recorder.getStatus().durationMillis || ms;
    try { await recorder.stop(); } catch { /* già fermo */ }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    setRecording(false);
    const uri = recorder.uri;
    if (!uri || dur < 500) return null;
    const note = { uri: persistFile(uri, 'nota-vocale.m4a'), durationMs: dur };
    setSaved(note);
    return note;
  }, [recorder, ms]);

  const start = useCallback(async (): Promise<void> => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new PermissionError('Permesso microfono negato: abilitalo dalle impostazioni del telefono.', perm.canAskAgain);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSaved(null); setMs(0); setRecording(true);
    clearTimer();
    timer.current = setInterval(() => {
      const d = recorder.getStatus().durationMillis;
      setMs(d);
      if (d >= VOICE_NOTE_MAX_MS) void stop();
    }, 200);
  }, [recorder, stop]);

  const discard = useCallback(() => setSaved(null), []);
  return { recording, ms, saved, start, stop, discard };
}
