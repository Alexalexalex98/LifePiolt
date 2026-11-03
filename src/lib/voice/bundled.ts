import { VOICE_CLIPS } from './voiceManifest';

/** Chiave di una frase: identica a quella di scripts/voice/generate.py (che crea i file in assets/voice). */
export function clipKey(text: string): string {
  let h = 5381;
  const s = text.trim();
  for (let i = 0; i < s.length; i++) h = (((h * 33) % 4294967296) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
/** La registrazione già inclusa nell'app per questa frase (voce italiana «Paola», Piper, CC0), se c'è. */
/** Interruttore: le registrazioni si usano solo dopo che la voce è stata approvata all'ascolto. */
export const BUNDLED_VOICE_ENABLED = false;
export function bundledClip(text: string): number | null {
  if (!BUNDLED_VOICE_ENABLED) return null;
  const m = VOICE_CLIPS[clipKey(text)];
  return m == null ? null : m;
}
