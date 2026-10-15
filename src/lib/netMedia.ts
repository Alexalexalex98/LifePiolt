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
  let r: ImagePicker.ImagePickerResult;
  try {
  r = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, mediaTypes: kind === 'photo' ? ['images'] : ['videos'], allowsMultipleSelection: false, quality: 0.8, videoMaxDuration: 120 });
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (/FailedToRead|representation|heic/i.test(m)) throw new Error('Non riesco a leggere questa foto. Se è su iCloud aspetta che si scarichi dal telefono, poi riprova (oppure scegline un\'altra).');
    throw e;
  }
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const isVideo = a.type === 'video' || (a.mimeType ?? '').startsWith('video/');
  const uri = Platform.OS === 'web' ? (isVideo ? a.uri : await webInline(a.uri)) : persistFile(a.uri, a.fileName ?? undefined);
  return { media: isVideo ? 'video' : 'photo', uri, name: a.fileName ?? undefined, durationMs: a.duration ?? undefined };
}

const toNet = async (a: ImagePicker.ImagePickerAsset): Promise<NetMedia> => {
  const isVideo = a.type === 'video' || (a.mimeType ?? '').startsWith('video/');
  const uri = Platform.OS === 'web' ? (isVideo ? a.uri : await webInline(a.uri)) : persistFile(a.uri, a.fileName ?? undefined);
  return { media: isVideo ? 'video' : 'photo', uri, name: a.fileName ?? undefined, durationMs: a.duration ?? undefined };
};
const readError = (e: unknown): Error => {
  const m = e instanceof Error ? e.message : '';
  return /FailedToRead|representation|heic/i.test(m) ? new Error('Non riesco a leggere questa foto. Se è su iCloud aspetta che si scarichi dal telefono, poi riprova (oppure scegline un\'altra).') : (e instanceof Error ? e : new Error('Non riesco ad aprire la libreria'));
};

/** Più foto e video insieme dalla libreria (fino a `max`). */
export async function pickNetMediaMany(max = 6): Promise<NetMedia[]> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error(perm.canAskAgain === false ? 'Permesso alla libreria negato: abilitalo da Impostazioni del telefono.' : 'Senza il permesso alla libreria non posso mostrarti foto e video.');
  }
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: max, orderedSelection: true, quality: 0.85, videoMaxDuration: 60 });
    if (r.canceled) return [];
    return await Promise.all(r.assets.slice(0, max).map(toNet));
  } catch (e) { throw readError(e); }
}

/** Scatta una foto con la fotocamera. */
export async function takeNetPhoto(): Promise<NetMedia | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Permesso fotocamera negato: abilitalo da Impostazioni del telefono.');
  }
  try {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    return r.canceled || !r.assets[0] ? null : await toNet(r.assets[0]);
  } catch (e) { throw readError(e); }
}

/** Gira un video con la fotocamera (fino a `maxSec` secondi). */
export async function takeNetVideo(maxSec = 30): Promise<NetMedia | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Permesso fotocamera negato: abilitalo da Impostazioni del telefono.');
  }
  try {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: maxSec, quality: 0.6 });
    return r.canceled || !r.assets[0] ? null : await toNet(r.assets[0]);
  } catch (e) { throw readError(e); }
}
