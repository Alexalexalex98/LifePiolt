import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { persistFile } from '@/lib/chatMedia';
import { libraryPermission } from '@/lib/mediaPerm';

const READ_FAIL = /FailedToRead|representation|heic|PHPhotos|3164|couldn.?t be completed|ph-error|resource/i;
const READ_MSG = 'Non riesco a leggere questa foto dal telefono. Di solito succede quando la memoria è quasi piena o la foto è su iCloud e non è ancora scaricata: libera un po\' di spazio (Impostazioni > Generali > Spazio iPhone), aspetta che si scarichi e riprova, oppure scegline un\'altra.';
/** Apre la libreria; se la lettura della foto fallisce (errori di Foto, iCloud, poco spazio) riprova senza conversione e poi con il file originale. */
async function launchLibrary(opts: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  const modes = [ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current, ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Automatic];
  let last: unknown;
  for (let i = 0; i < modes.length; i++) {
    try {
      return await ImagePicker.launchImageLibraryAsync({ ...opts, preferredAssetRepresentationMode: modes[i], ...(i > 0 ? { quality: 1 } : {}) });
    } catch (e) {
      last = e;
      if (!READ_FAIL.test(e instanceof Error ? e.message : String(e))) break;
    }
  }
  /* ultimo tentativo, il piu' semplice possibile (nessuna opzione speciale): se anche questo fallisce, si dice il motivo vero */
  try { return await ImagePicker.launchImageLibraryAsync({ mediaTypes: opts.mediaTypes, allowsMultipleSelection: opts.allowsMultipleSelection, selectionLimit: opts.selectionLimit }); }
  catch (e) { last = e; }
  const why = last instanceof Error ? last.message : String(last);
  throw new Error(`${READ_FAIL.test(why) ? READ_MSG : 'Non riesco ad aprire la libreria foto.'} (${why.slice(0, 120)})`);
}

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
    const perm = await libraryPermission();
    if (!perm.granted) {
      throw new Error(perm.canAskAgain === false
        ? 'Permesso alla libreria negato: abilitalo da Impostazioni del telefono per scegliere foto e video.'
        : 'Senza il permesso alla libreria non posso mostrarti foto e video. Riprova e consenti l’accesso.');
    }
  }
  let r: ImagePicker.ImagePickerResult;
  try {
  r = await launchLibrary({ mediaTypes: kind === 'photo' ? ['images'] : ['videos'], allowsMultipleSelection: false, quality: 0.8, videoMaxDuration: 120 });
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (READ_FAIL.test(m)) throw new Error(READ_MSG);
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
  return READ_FAIL.test(m) ? new Error(READ_MSG) : (e instanceof Error ? e : new Error('Non riesco ad aprire la libreria'));
};

/** Più foto e video insieme dalla libreria (fino a `max`). */
export async function pickNetMediaMany(max = 6): Promise<NetMedia[]> {
  if (Platform.OS !== 'web') {
    const perm = await libraryPermission();
    if (!perm.granted) throw new Error(perm.canAskAgain === false ? 'Permesso alla libreria negato: abilitalo da Impostazioni del telefono.' : 'Senza il permesso alla libreria non posso mostrarti foto e video.');
  }
  try {
    const r = await launchLibrary({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: max, orderedSelection: true, quality: 0.85, videoMaxDuration: 60 });
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
