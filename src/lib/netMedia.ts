import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { persistFile } from '@/lib/chatMedia';

export type NetMedia = { media: 'photo' | 'video'; uri: string; name?: string; durationMs?: number };

/** Dimensione massima per tenere un file come data-URL nel salvataggio locale del browser (solo web). */
const WEB_INLINE_MAX = 900 * 1024;

async function webInline(uri: string): Promise<string> {
  try {
    const blob = await (await fetch(uri)).blob();
    if (blob.size > WEB_INLINE_MAX) return uri; // troppo grande: resta valido solo finché la pagina è aperta
    return await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  } catch { return uri; }
}

/**
 * Sceglie una foto o un video dalla libreria (su web apre il selettore di file del browser).
 * Ritorna null se l'utente annulla; lancia Error con un messaggio in italiano se il permesso è negato o la scelta fallisce.
 */
export async function pickNetMedia(kind: 'photo' | 'video'): Promise<NetMedia | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error(perm.canAskAgain === false
        ? 'Permesso alla libreria negato: abilitalo da Impostazioni del telefono per scegliere foto e video.'
        : 'Senza il permesso alla libreria non posso mostrarti foto e video. Riprova e consenti l’accesso.');
    }
  }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'photo' ? ['images'] : ['videos'], allowsMultipleSelection: false, quality: 0.8, videoMaxDuration: 120 });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const isVideo = a.type === 'video' || (a.mimeType ?? '').startsWith('video/');
  const uri = Platform.OS === 'web' ? (isVideo ? a.uri : await webInline(a.uri)) : persistFile(a.uri, a.fileName ?? undefined);
  return { media: isVideo ? 'video' : 'photo', uri, name: a.fileName ?? undefined, durationMs: a.duration ?? undefined };
}
